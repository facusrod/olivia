import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import type { PipelineStage } from 'mongoose';
import { authOptions } from '@/lib/auth-options';
import { getOdooClient } from '@/lib/odoo';
import connectDB from '@/lib/mongodb';
import DashboardSnapshot from '@/models/DashboardSnapshot';
import MonthlySalesHistory from '@/models/MonthlySalesHistory';
import ExpiredProductSnapshot from '@/models/ExpiredProductSnapshot';
import pLimit from 'p-limit';

/**
 * Helper: wrappea una promesa para medir y loguear su tiempo de ejecución.
 */
function timed<T>(label: string, promise: Promise<T>): Promise<T> {
  const start = Date.now();
  return promise.then(
    (result) => { console.log(`⏱️ ${label}: ${Date.now() - start}ms`); return result; },
    (error) => { console.log(`⏱️ ${label}: ${Date.now() - start}ms (ERROR)`); throw error; }
  );
}

/** Retorna el historial mensual guardado en MongoDB, ordenado por mes ascendente. */
async function getSalesHistory() {
  return MonthlySalesHistory.find().sort({ month: 1 }).lean();
}

/** Fallback cuando falla Odoo: devuelve último snapshot + historial o error. */
async function getFallbackDashboardResponse() {
  const lastSnapshot = await DashboardSnapshot.findOne()
    .sort({ generatedAt: -1 })
    .lean();

  if (lastSnapshot) {
    const salesHistory = await getSalesHistory();
    console.warn('Odoo unavailable, returning cached snapshot from:', lastSnapshot.generatedAt);
    return NextResponse.json({
      sales: lastSnapshot.sales,
      orders: lastSnapshot.orders,
      inventory: lastSnapshot.inventory,
      products: lastSnapshot.products,
      salesHistory,
      updatedAt: lastSnapshot.generatedAt,
      cached: true,
    });
  }

  return null;
}

/** Mes actual en formato "YYYY-MM", en hora Argentina. */
function getCurrentMonthArg(): string {
  const ART_OFFSET = 3;
  const todayArg = new Date(Date.now() - ART_OFFSET * 3600000);
  return `${todayArg.getUTCFullYear()}-${String(todayArg.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Etapas compartidas: por cada lote (productId+lotName) que aparece vencido en algún
 * snapshot diario del mes, se queda con su primera aparición (el día que originalmente
 * venció). El cron no da de baja el lote al procesarlo, así que un mismo lote vencido
 * puede repetirse en varios snapshots diarios seguidos — sin este dedup se sumaría su
 * valor una vez por cada día que reaparece. Se toma la primera aparición y no la más
 * reciente porque si luego se descartó parcialmente, la cantidad/valor de días
 * posteriores ya no refleja lo que vencía originalmente.
 */
function dedupedExpiredItemsStages(monthStr: string): PipelineStage[] {
  return [
    { $match: { date: { $regex: `^${monthStr}` } } },
    { $unwind: '$items' },
    { $sort: { date: 1 } },
    {
      $group: {
        _id: { productId: '$items.productId', lotName: '$items.lotName' },
        category: { $first: '$items.category' },
        qty: { $first: '$items.qty' },
        value: { $first: '$items.totalValue' },
      },
    },
  ];
}

/**
 * Suma qty/valor, deduplicados por lote, de los snapshots diarios de vencidos del mes
 * actual (hora Argentina). Los snapshots ya existen antes de que el producto sea
 * descartado en Odoo (ver cron /api/cron/expired-products), así que esto no depende de
 * una consulta en vivo a Odoo.
 */
async function getExpiredMonthTotal(): Promise<{ qty: number; value: number }> {
  const monthStr = getCurrentMonthArg();

  const result = await ExpiredProductSnapshot.aggregate([
    ...dedupedExpiredItemsStages(monthStr),
    { $group: { _id: null, qty: { $sum: '$qty' }, value: { $sum: '$value' } } },
  ]);

  return result[0] ? { qty: result[0].qty, value: result[0].value } : { qty: 0, value: 0 };
}

/** Desglose por categoría de los vencidos del mes actual, deduplicados por lote, ordenado de mayor a menor valor. */
async function getExpiredCategoryBreakdown(): Promise<Array<{ category: string; qty: number; value: number }>> {
  const monthStr = getCurrentMonthArg();

  const result = await ExpiredProductSnapshot.aggregate([
    ...dedupedExpiredItemsStages(monthStr),
    {
      $group: {
        _id: { $ifNull: ['$category', 'Sin categoría'] },
        qty: { $sum: '$qty' },
        value: { $sum: '$value' },
      },
    },
    { $sort: { value: -1 } },
  ]);

  return result.map((r) => ({ category: r._id, qty: r.qty, value: r.value }));
}

/**
 * Suma buckets por hora en turnos Mañana (9-13h ART) y Tarde (resto).
 */
function reduceShifts(buckets: Array<{ hour: number; count: number; revenue: number }>) {
  const morning = { revenue: 0, count: 0 };
  const afternoon = { revenue: 0, count: 0 };
  for (const b of buckets) {
    const target = (b.hour >= 9 && b.hour < 13) ? morning : afternoon;
    target.revenue += b.revenue;
    target.count += b.count;
  }
  return { morning, afternoon };
}

/**
 * Backfillea posMorning/posAfternoon en meses históricos que aún no los tengan.
 * Corre una query por mes faltante (con concurrencia limitada). Idempotente.
 */
async function backfillPosShiftsIfNeeded() {
  const missing = await MonthlySalesHistory.find(
    { posMorning: { $exists: false } },
    { month: 1 }
  ).sort({ month: 1 }).lean();

  if (missing.length === 0) return;

  console.log(`🔄 Backfill de turnos PDV para ${missing.length} meses históricos`);
  const odoo = getOdooClient();
  const confirmedStates = ['sale', 'done', 'paid', 'invoiced'];
  const ART_OFFSET = 3;
  const limit = pLimit(3);

  await Promise.all(missing.map((doc) => limit(async () => {
    const [year, m] = doc.month.split('-').map((s) => parseInt(s, 10));
    const start = new Date(Date.UTC(year, m - 1, 1, ART_OFFSET, 0, 0));
    const end = new Date(Date.UTC(year, m, 1, ART_OFFSET, 0, 0));

    const buckets = await timed(`backfill-${doc.month}`, odoo.getOrderStatsByHour('pos.order', [
      ['date_order', '>=', start.toISOString()],
      ['date_order', '<', end.toISOString()],
      ['state', 'in', confirmedStates],
    ]));

    const { morning, afternoon } = reduceShifts(buckets);
    await MonthlySalesHistory.updateOne(
      { month: doc.month },
      {
        $set: {
          posMorning: morning.revenue,
          posAfternoon: afternoon.revenue,
          posMorningCount: morning.count,
          posAfternoonCount: afternoon.count,
        },
      }
    );
  })));
}

/**
 * Sincroniza el historial mensual de ventas en MongoDB.
 * - Primera vez (sin registros): fetch de toda la historia desde Odoo (2 RPC calls con groupby month).
 * - Siguientes veces: solo re-fetch del mes actual (2 RPC calls — reutiliza getPosOrderStats/getEcommerceOrderStats).
 * Los meses cerrados nunca se re-consultan a Odoo.
 * Al final: backfillea turnos PDV en meses históricos que no los tengan (1 vez por mes).
 */
async function syncMonthlySalesHistory() {
  const odoo = getOdooClient();
  const confirmedStates = ['sale', 'done', 'paid', 'invoiced'];

  const ART_OFFSET = 3;
  const now = new Date();
  const todayArg = new Date(now.getTime() - ART_OFFSET * 3600000);
  const currentMonth = `${todayArg.getUTCFullYear()}-${String(todayArg.getUTCMonth() + 1).padStart(2, '0')}`;

  const startOfCurrentMonth = new Date(Date.UTC(
    todayArg.getUTCFullYear(), todayArg.getUTCMonth(), 1,
    ART_OFFSET, 0, 0
  ));

  const existingCount = await MonthlySalesHistory.countDocuments();

  if (existingCount === 0) {
    // Primera carga: fetch toda la historia con groupby month (1 RPC por canal)
    const [posHistory, ecomHistory] = await Promise.all([
      timed('monthlyPos-full', odoo.getMonthlyRevenueByChannel('pos.order', [['state', 'in', confirmedStates]])),
      timed('monthlyEcom-full', odoo.getMonthlyRevenueByChannel('sale.order', [['state', 'in', confirmedStates]])),
    ]);

    // Merge POS + Ecom por mes
    const monthMap = new Map<string, { pos: number; ecom: number; posCount: number; ecomCount: number }>();
    for (const r of posHistory) {
      monthMap.set(r.month, { pos: r.revenue, ecom: 0, posCount: r.count, ecomCount: 0 });
    }
    for (const r of ecomHistory) {
      const existing = monthMap.get(r.month) ?? { pos: 0, ecom: 0, posCount: 0, ecomCount: 0 };
      monthMap.set(r.month, { ...existing, ecom: r.revenue, ecomCount: r.count });
    }

    // Bulk upsert en MongoDB
    const ops = Array.from(monthMap.entries()).map(([month, data]) => ({
      updateOne: {
        filter: { month },
        update: { $set: { month, ...data, total: data.pos + data.ecom } },
        upsert: true,
      },
    }));
    if (ops.length > 0) await MonthlySalesHistory.bulkWrite(ops);
  } else {
    // Solo actualizar el mes actual (meses pasados son inmutables)
    const [posMonth, ecomMonth, posMonthByHour] = await Promise.all([
      timed('monthlyPos-current', odoo.getPosOrderStats([
        ['date_order', '>=', startOfCurrentMonth.toISOString()],
        ['state', 'in', confirmedStates],
      ])),
      timed('monthlyEcom-current', odoo.getEcommerceOrderStats([
        ['date_order', '>=', startOfCurrentMonth.toISOString()],
        ['state', 'in', confirmedStates],
      ])),
      timed('monthlyPosByHour-current', odoo.getOrderStatsByHour('pos.order', [
        ['date_order', '>=', startOfCurrentMonth.toISOString()],
        ['state', 'in', confirmedStates],
      ])),
    ]);

    const { morning, afternoon } = reduceShifts(posMonthByHour);

    await MonthlySalesHistory.updateOne(
      { month: currentMonth },
      {
        $set: {
          month: currentMonth,
          pos: posMonth.revenue,
          ecom: ecomMonth.revenue,
          total: posMonth.revenue + ecomMonth.revenue,
          posCount: posMonth.count,
          ecomCount: ecomMonth.count,
          posMorning: morning.revenue,
          posAfternoon: afternoon.revenue,
          posMorningCount: morning.count,
          posAfternoonCount: afternoon.count,
        },
      },
      { upsert: true }
    );
  }

  // Backfill de meses históricos sin datos de turno (idempotente).
  await backfillPosShiftsIfNeeded();
}

/**
 * GET - Devuelve el último snapshot guardado.
 * Si no existe ninguno, genera uno automáticamente.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    // Buscar el último snapshot
    const lastSnapshot = await DashboardSnapshot.findOne()
      .sort({ generatedAt: -1 })
      .lean();

    const salesHistory = await getSalesHistory();

    if (lastSnapshot && lastSnapshot.generatedAt >= new Date(Date.now() - 60 * 60 * 1000)) { // Si el snapshot es reciente (menos de 1 hora), devolverlo
      return NextResponse.json({
        sales: lastSnapshot.sales,
        orders: lastSnapshot.orders,
        inventory: lastSnapshot.inventory,
        products: lastSnapshot.products,
        salesHistory,
        updatedAt: lastSnapshot.generatedAt,
      });
    }

    // No hay snapshot, generar el primero automáticamente
    const [data, , expiredMonth, expiredByCategory] = await Promise.all([
      generateDashboardData(),
      syncMonthlySalesHistory(),
      getExpiredMonthTotal(),
      getExpiredCategoryBreakdown(),
    ]);

    const snapshot = await DashboardSnapshot.create({
      ...data,
      inventory: { ...data.inventory, expiredMonth },
      products: { ...data.products, expiredByCategory },
      generatedAt: new Date(),
    });

    const freshHistory = await getSalesHistory();

    return NextResponse.json({
      sales: snapshot.sales,
      orders: snapshot.orders,
      inventory: snapshot.inventory,
      products: snapshot.products,
      salesHistory: freshHistory,
      updatedAt: snapshot.generatedAt,
    });
  } catch (error: any) {
    console.error('Dashboard GET error:', error);
    const fallback = await getFallbackDashboardResponse();
    if (fallback) return fallback;

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST - Regenera el dashboard: calcula todas las métricas desde Odoo y guarda nuevo snapshot.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    // Ambas operaciones en paralelo: dashboard metrics + historial mensual
    const [data, , expiredMonth, expiredByCategory] = await Promise.all([
      generateDashboardData(),
      syncMonthlySalesHistory(),
      getExpiredMonthTotal(),
      getExpiredCategoryBreakdown(),
    ]);

    const snapshot = await DashboardSnapshot.create({
      ...data,
      inventory: { ...data.inventory, expiredMonth },
      products: { ...data.products, expiredByCategory },
      generatedAt: new Date(),
    });

    const salesHistory = await getSalesHistory();

    return NextResponse.json({
      sales: snapshot.sales,
      orders: snapshot.orders,
      inventory: snapshot.inventory,
      products: snapshot.products,
      salesHistory,
      updatedAt: snapshot.generatedAt,
    });
  } catch (error: any) {
    console.error('Dashboard POST error:', error);
    const fallback = await getFallbackDashboardResponse();
    if (fallback) return fallback;

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Genera todos los datos del dashboard consultando Odoo.
 *
 * Optimizaciones aplicadas:
 * 1. read_group: usa agregación server-side en vez de traer registros individuales
 * 2. getProductCount + getInventoryValue: reemplazan getProductsForInventory (6 RPC → 3 queries rápidas)
 * 3. read_group sin groupby: cada query devuelve 1 fila con totales (independiente del locale)
 */
async function generateDashboardData() {
  const totalStart = Date.now();
  const odoo = getOdooClient();

  // Limitar concurrencia para no saturar workers de Odoo
  const limit = pLimit(3);

  // Argentina = UTC-3. Todas las fechas se calculan en hora Argentina
  // para que "hoy" y "este mes" coincidan con el horario del negocio.
  const ART_OFFSET = 3; // horas a sumar a medianoche ART para obtener UTC

  const now = new Date();
  // Qué día es "hoy" en Argentina
  const todayArg = new Date(now.getTime() - ART_OFFSET * 3600000);

  // Medianoche de hoy en Argentina = 03:00 UTC del mismo día
  const startOfDay = new Date(Date.UTC(
    todayArg.getUTCFullYear(), todayArg.getUTCMonth(), todayArg.getUTCDate(),
    ART_OFFSET, 0, 0
  ));

  // Primer día del mes actual en Argentina
  const startOfMonth = new Date(Date.UTC(
    todayArg.getUTCFullYear(), todayArg.getUTCMonth(), 1,
    ART_OFFSET, 0, 0
  ));

  // Primer día del mes anterior en Argentina
  const startOfLastMonth = new Date(Date.UTC(
    todayArg.getUTCFullYear(), todayArg.getUTCMonth() - 1, 1,
    ART_OFFSET, 0, 0
  ));

  // Fin del mes anterior = inicio del mes actual menos 1 segundo
  const endOfLastMonth = new Date(startOfMonth.getTime() - 1000);

  const confirmedStates = ['sale', 'done', 'paid', 'invoiced'];

  // --- Queries paralelas con p-limit(3) ---
  // Máximo 3 queries simultáneas para no saturar workers de Odoo.
  // Cada query tiene timing log para diagnosticar cuellos de botella.
  const [
    salesRanking,
    expiringProducts,
    totalProducts,
    outOfStockCount,
    inventoryValue,
    posToday,
    ecomToday,
    posMonth,
    ecomMonth,
    posLastMonth,
    ecomLastMonth,
    posMonthByHour,
  ] = await Promise.all([
    limit(() => timed('getProductSalesRanking', odoo.getProductSalesRanking(30, 50, 50))),
    limit(() => timed('getExpiringProducts', odoo.getExpiringProducts(30, 50))),
    limit(() => timed('totalProducts', odoo.getProductCount())),
    limit(() => timed('outOfStock', odoo.getProductCount([['qty_available', '<=', 0]]))),
    limit(() => timed('inventoryValue', odoo.getInventoryValue())),
    limit(() => timed('posToday', odoo.getPosOrderStats([
      ['date_order', '>=', startOfDay.toISOString()],
      ['state', 'in', confirmedStates],
    ]))),
    limit(() => timed('ecomToday', odoo.getEcommerceOrderStats([
      ['date_order', '>=', startOfDay.toISOString()],
      ['state', 'in', confirmedStates],
    ]))),
    limit(() => timed('posMonth', odoo.getPosOrderStats([
      ['date_order', '>=', startOfMonth.toISOString()],
      ['state', 'in', confirmedStates],
    ]))),
    limit(() => timed('ecomMonth', odoo.getEcommerceOrderStats([
      ['date_order', '>=', startOfMonth.toISOString()],
      ['state', 'in', confirmedStates],
    ]))),
    limit(() => timed('posLastMonth', odoo.getPosOrderStats([
      ['date_order', '>=', startOfLastMonth.toISOString()],
      ['date_order', '<=', endOfLastMonth.toISOString()],
      ['state', 'in', confirmedStates],
    ]))),
    limit(() => timed('ecomLastMonth', odoo.getEcommerceOrderStats([
      ['date_order', '>=', startOfLastMonth.toISOString()],
      ['date_order', '<=', endOfLastMonth.toISOString()],
      ['state', 'in', confirmedStates],
    ]))),
    limit(() => timed('posMonthByHour', odoo.getOrderStatsByHour('pos.order', [
      ['date_order', '>=', startOfMonth.toISOString()],
      ['state', 'in', confirmedStates],
    ]))),
  ]);

  // Agregar ventas del mes por turno (POS). Mañana: 9-13h, Tarde: resto.
  // Los buckets vienen con hora en ART.
  const monthByShift = {
    morning: { revenue: 0, count: 0 },
    afternoon: { revenue: 0, count: 0 },
  };
  for (const bucket of posMonthByHour) {
    const isMorning = bucket.hour >= 9 && bucket.hour < 13;
    const target = isMorning ? monthByShift.morning : monthByShift.afternoon;
    target.revenue += bucket.revenue;
    target.count += bucket.count;
  }

  // Totales combinados (lectura directa, sin parsing de fechas)
  const todayRevenue = posToday.revenue + ecomToday.revenue;
  const monthRevenue = posMonth.revenue + ecomMonth.revenue;
  const lastMonthRevenue = posLastMonth.revenue + ecomLastMonth.revenue;

  const totalOrdersToday = posToday.count + ecomToday.count;
  const totalOrdersMonth = posMonth.count + ecomMonth.count;

  const growthPercentage = lastMonthRevenue > 0
    ? ((monthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
    : 0;

  const averageTicket = totalOrdersMonth > 0
    ? monthRevenue / totalOrdersMonth
    : 0;

  // Desestructurar ranking de ventas
  const { topSelling: topSellingProducts, leastSelling: leastSellingProducts } = salesRanking;

  console.log(`📊 Dashboard generado: ${totalProducts} productos, valor total: ${inventoryValue}`);
  console.log(`⏱️ TOTAL generateDashboardData: ${Date.now() - totalStart}ms`);

  return {
    sales: {
      today: todayRevenue,
      month: monthRevenue,
      lastMonth: lastMonthRevenue,
      growthPercentage,
      averageTicket,
      monthByShift,
    },
    orders: {
      today: totalOrdersToday,
      month: totalOrdersMonth,
      pos: {
        today: posToday.count,
        month: posMonth.count,
        revenueToday: posToday.revenue,
        revenueMonth: posMonth.revenue,
      },
      ecommerce: {
        today: ecomToday.count,
        month: ecomMonth.count,
        revenueToday: ecomToday.revenue,
        revenueMonth: ecomMonth.revenue,
      },
    },
    inventory: {
      outOfStock: outOfStockCount,
      totalValue: inventoryValue,
      expiringSoon: expiringProducts.length,
      totalProducts: totalProducts,
    },
    products: {
      topSelling: topSellingProducts,
      slowMoving: leastSellingProducts,
      expiring: expiringProducts,
    },
  };
}
