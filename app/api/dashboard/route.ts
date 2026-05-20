import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getOdooClient } from '@/lib/odoo';
import connectDB from '@/lib/mongodb';
import DashboardSnapshot from '@/models/DashboardSnapshot';
import MonthlySalesHistory from '@/models/MonthlySalesHistory';
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

/**
 * Sincroniza el historial mensual de ventas en MongoDB.
 * - Primera vez (sin registros): fetch de toda la historia desde Odoo (2 RPC calls con groupby month).
 * - Siguientes veces: solo re-fetch del mes actual (2 RPC calls — reutiliza getPosOrderStats/getEcommerceOrderStats).
 * Los meses cerrados nunca se re-consultan a Odoo.
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
    const [posMonth, ecomMonth] = await Promise.all([
      timed('monthlyPos-current', odoo.getPosOrderStats([
        ['date_order', '>=', startOfCurrentMonth.toISOString()],
        ['state', 'in', confirmedStates],
      ])),
      timed('monthlyEcom-current', odoo.getEcommerceOrderStats([
        ['date_order', '>=', startOfCurrentMonth.toISOString()],
        ['state', 'in', confirmedStates],
      ])),
    ]);

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
        },
      },
      { upsert: true }
    );
  }
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
        salesHeatmap: lastSnapshot.salesHeatmap || [],
        salesHistory,
        updatedAt: lastSnapshot.generatedAt,
      });
    }

    // No hay snapshot, generar el primero automáticamente
    const [data] = await Promise.all([
      generateDashboardData(),
      syncMonthlySalesHistory(),
    ]);

    const snapshot = await DashboardSnapshot.create({
      ...data,
      generatedAt: new Date(),
    });

    const freshHistory = await getSalesHistory();

    return NextResponse.json({
      sales: snapshot.sales,
      orders: snapshot.orders,
      inventory: snapshot.inventory,
      products: snapshot.products,
      salesHeatmap: snapshot.salesHeatmap || [],
      salesHistory: freshHistory,
      updatedAt: snapshot.generatedAt,
    });
  } catch (error: any) {
    console.error('Dashboard GET error:', error);
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
    const [data] = await Promise.all([
      generateDashboardData(),
      syncMonthlySalesHistory(),
    ]);

    const snapshot = await DashboardSnapshot.create({
      ...data,
      generatedAt: new Date(),
    });

    const salesHistory = await getSalesHistory();

    return NextResponse.json({
      sales: snapshot.sales,
      orders: snapshot.orders,
      inventory: snapshot.inventory,
      products: snapshot.products,
      salesHeatmap: snapshot.salesHeatmap || [],
      salesHistory,
      updatedAt: snapshot.generatedAt,
    });
  } catch (error: any) {
    console.error('Dashboard POST error:', error);
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

  // Hace 7 días en Argentina (para heatmap)
  const startOf7DaysAgo = new Date(Date.UTC(
    todayArg.getUTCFullYear(), todayArg.getUTCMonth(), todayArg.getUTCDate() - 7,
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
    posTimestamps,
    ecomTimestamps,
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
    // Timestamps para heatmap de ventas (últimos 7 días)
    limit(() => timed('posTimestamps', odoo.getOrderTimestamps('pos.order', [
      ['date_order', '>=', startOf7DaysAgo.toISOString()],
      ['state', 'in', confirmedStates],
    ]))),
    limit(() => timed('ecomTimestamps', odoo.getOrderTimestamps('sale.order', [
      ['date_order', '>=', startOf7DaysAgo.toISOString()],
      ['state', 'in', confirmedStates],
    ]))),
  ]);

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

  // Construir heatmap de ventas (hora × día de semana) con timestamps del último mes
  const salesHeatmap = buildSalesHeatmap([...posTimestamps, ...ecomTimestamps]);

  console.log(`📊 Dashboard generado: ${totalProducts} productos, valor total: ${inventoryValue}`);
  console.log(`⏱️ TOTAL generateDashboardData: ${Date.now() - totalStart}ms`);

  return {
    sales: {
      today: todayRevenue,
      month: monthRevenue,
      lastMonth: lastMonthRevenue,
      growthPercentage,
      averageTicket,
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
    salesHeatmap,
  };
}

/**
 * Construye una matriz de heatmap (16 filas × 7 columnas) a partir de timestamps de órdenes.
 * Filas: horas 07:00 a 22:00 (hora Argentina UTC-3)
 * Columnas: Lun(0) a Dom(6)
 */
function buildSalesHeatmap(timestamps: string[]): number[][] {
  const HOUR_START = 7;
  const HOUR_END = 22;
  const HOURS = HOUR_END - HOUR_START + 1; // 16 filas
  const DAYS = 7;
  const ART_OFFSET_MS = 3 * 3600000; // UTC-3

  // Inicializar matriz en 0
  const matrix: number[][] = Array.from({ length: HOURS }, () => Array(DAYS).fill(0));

  for (const ts of timestamps) {
    if (!ts) continue;
    // Odoo timestamps pueden ser "YYYY-MM-DD HH:MM:SS" (sin Z) o ISO
    const date = new Date(ts.includes('Z') || ts.includes('+') ? ts : ts + 'Z');
    // Convertir UTC → Argentina (UTC-3)
    const artTime = new Date(date.getTime() - ART_OFFSET_MS);
    const hour = artTime.getUTCHours();
    // getUTCDay: 0=Dom, 1=Lun ... 6=Sáb → convertir a 0=Lun, 6=Dom
    const jsDay = artTime.getUTCDay();
    const day = jsDay === 0 ? 6 : jsDay - 1;

    if (hour >= HOUR_START && hour <= HOUR_END) {
      matrix[hour - HOUR_START][day]++;
    }
  }

  return matrix;
}
