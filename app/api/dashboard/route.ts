import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getOdooClient } from '@/lib/odoo';
import connectDB from '@/lib/mongodb';
import DashboardSnapshot from '@/models/DashboardSnapshot';
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

    if (lastSnapshot && lastSnapshot.generatedAt >= new Date(Date.now() - 60 * 60 * 1000)) { // Si el snapshot es reciente (menos de 1 hora), devolverlo
      return NextResponse.json({
        sales: lastSnapshot.sales,
        orders: lastSnapshot.orders,
        inventory: lastSnapshot.inventory,
        products: lastSnapshot.products,
        updatedAt: lastSnapshot.generatedAt,
      });
    }

    // No hay snapshot, generar el primero automáticamente
    const data = await generateDashboardData();

    const snapshot = await DashboardSnapshot.create({
      ...data,
      generatedAt: new Date(),
    });

    return NextResponse.json({
      sales: snapshot.sales,
      orders: snapshot.orders,
      inventory: snapshot.inventory,
      products: snapshot.products,
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

    const data = await generateDashboardData();

    const snapshot = await DashboardSnapshot.create({
      ...data,
      generatedAt: new Date(),
    });

    return NextResponse.json({
      sales: snapshot.sales,
      orders: snapshot.orders,
      inventory: snapshot.inventory,
      products: snapshot.products,
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
    lowStockProducts,
    topSellingProducts,
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
  ] = await Promise.all([
    limit(() => timed('getLowStockProducts', odoo.getLowStockProducts(10))),
    limit(() => timed('getTopSellingProducts', odoo.getTopSellingProducts(30, 5))),
    limit(() => timed('getExpiringProducts', odoo.getExpiringProducts(30, 10))),
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

  // Debug
  console.log('🔍 Dashboard debug:', {
    pos: { today: posToday.count, month: posMonth.count },
    ecommerce: { today: ecomToday.count, month: ecomMonth.count },
    revenue: { posToday: posToday.revenue, ecomToday: ecomToday.revenue, total: todayRevenue },
  });

  // Slow moving: productos con stock alto que no están en top ventas (depende de topSellingProducts)
  const topSellingIds = topSellingProducts.map((p: any) => p.id);
  console.log('🔍 topSellingIds para excluir:', topSellingIds);
  const slowMovingProducts = await timed('getSlowMovingProducts', odoo.getSlowMovingProducts(topSellingIds, 5));
  console.log('🔍 slowMovingProducts:', JSON.stringify(slowMovingProducts));

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
      lowStock: lowStockProducts.length,
      outOfStock: outOfStockCount,
      totalValue: inventoryValue,
      expiringSoon: expiringProducts.length,
      totalProducts: totalProducts,
    },
    products: {
      topSelling: topSellingProducts,
      lowStock: lowStockProducts.slice(0, 5),
      slowMoving: slowMovingProducts,
      expiring: expiringProducts,
    },
  };
}
