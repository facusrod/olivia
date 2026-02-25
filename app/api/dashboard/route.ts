import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getOdooClient } from '@/lib/odoo';
import connectDB from '@/lib/mongodb';
import DashboardSnapshot from '@/models/DashboardSnapshot';

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
 * Helper: suma count y revenue de un array de stats por día.
 */
function sumStats(stats: Array<{ date: string; count: number; revenue: number }>) {
  return stats.reduce(
    (acc, row) => ({ count: acc.count + row.count, revenue: acc.revenue + row.revenue }),
    { count: 0, revenue: 0 }
  );
}

/**
 * Helper: filtra stats que correspondan al día de hoy en Argentina.
 * Odoo read_group devuelve dates como "24 Feb 2026", "25 Feb 2026", etc.
 * Comparamos contra la fecha argentina formateada.
 */
function filterTodayStats(
  stats: Array<{ date: string; count: number; revenue: number }>,
  todayArg: Date
) {
  // Formatear la fecha de hoy en Argentina al formato que usa Odoo: "DD MMM YYYY"
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = String(todayArg.getUTCDate()).padStart(2, '0');
  const month = months[todayArg.getUTCMonth()];
  const year = todayArg.getUTCFullYear();
  const todayStr = `${day} ${month} ${year}`;

  return stats.filter((row) => row.date === todayStr);
}

/**
 * Genera todos los datos del dashboard consultando Odoo.
 *
 * Optimizaciones aplicadas:
 * 1. read_group: usa agregación server-side en vez de traer registros individuales
 * 2. Campos mínimos: getProductsForInventory solo trae id, name, list_price, qty_available
 * 3. Sin redundancia: "hoy" se deriva de los datos del mes (read_group por día)
 */
async function generateDashboardData() {
  const odoo = getOdooClient();

  // Argentina = UTC-3. Todas las fechas se calculan en hora Argentina
  // para que "hoy" y "este mes" coincidan con el horario del negocio.
  const ART_OFFSET = 3; // horas a sumar a medianoche ART para obtener UTC

  const now = new Date();
  // Qué día es "hoy" en Argentina
  const todayArg = new Date(now.getTime() - ART_OFFSET * 3600000);

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

  // --- Queries paralelas OPTIMIZADAS ---
  // 8 queries livianas: 4 inventario + 2 read_group mes + 2 read_group lastMonth
  const [
    lowStockProducts,
    topSellingProducts,
    expiringProducts,
    allProducts,
    posMonthStats,
    ecomMonthStats,
    posLastMonthStats,
    ecomLastMonthStats,
  ] = await Promise.all([
    odoo.getLowStockProducts(10),
    odoo.getTopSellingProducts(30, 5),
    odoo.getExpiringProducts(30, 10),
    odoo.getProductsForInventory([]),
    odoo.getPosOrderStats([
      ['date_order', '>=', startOfMonth.toISOString()],
      ['state', 'in', confirmedStates],
    ]),
    odoo.getEcommerceOrderStats([
      ['date_order', '>=', startOfMonth.toISOString()],
      ['state', 'in', confirmedStates],
    ]),
    odoo.getPosOrderStats([
      ['date_order', '>=', startOfLastMonth.toISOString()],
      ['date_order', '<=', endOfLastMonth.toISOString()],
      ['state', 'in', confirmedStates],
    ]),
    odoo.getEcommerceOrderStats([
      ['date_order', '>=', startOfLastMonth.toISOString()],
      ['date_order', '<=', endOfLastMonth.toISOString()],
      ['state', 'in', confirmedStates],
    ]),
  ]);

  // Derivar "hoy" de los datos del mes (eliminar query redundante)
  const posTodayStats = sumStats(filterTodayStats(posMonthStats, todayArg));
  const posMonthTotals = sumStats(posMonthStats);
  const ecomTodayStats = sumStats(filterTodayStats(ecomMonthStats, todayArg));
  const ecomMonthTotals = sumStats(ecomMonthStats);

  // LastMonth
  const posLM = sumStats(posLastMonthStats);
  const ecomLM = sumStats(ecomLastMonthStats);

  // Totales combinados
  const posRevenueToday = posTodayStats.revenue;
  const posRevenueMonth = posMonthTotals.revenue;
  const ecomRevenueToday = ecomTodayStats.revenue;
  const ecomRevenueMonth = ecomMonthTotals.revenue;

  const todayRevenue = posRevenueToday + ecomRevenueToday;
  const monthRevenue = posRevenueMonth + ecomRevenueMonth;
  const lastMonthRevenue = posLM.revenue + ecomLM.revenue;

  const totalOrdersToday = posTodayStats.count + ecomTodayStats.count;
  const totalOrdersMonth = posMonthTotals.count + ecomMonthTotals.count;

  const growthPercentage = lastMonthRevenue > 0
    ? ((monthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
    : 0;

  const averageTicket = totalOrdersMonth > 0
    ? monthRevenue / totalOrdersMonth
    : 0;

  // Debug
  console.log('🔍 Dashboard debug:', {
    pos: { today: posTodayStats.count, month: posMonthTotals.count },
    ecommerce: { today: ecomTodayStats.count, month: ecomMonthTotals.count },
    revenue: { posToday: posRevenueToday, ecomToday: ecomRevenueToday, total: todayRevenue },
  });

  // Métricas de inventario (campos mínimos: id, name, list_price, qty_available)
  const outOfStockCount = allProducts.filter((p: any) => p.qty_available <= 0).length;
  const totalInventoryValue = allProducts.reduce(
    (sum: number, p: any) => sum + (p.list_price * Math.max(0, p.qty_available)),
    0
  );

  // Productos con menos movimiento
  const topSellingIds = new Set(topSellingProducts.map((p: any) => p.id));
  const slowMovingProducts = allProducts
    .filter((p: any) => p.qty_available > 0 && !topSellingIds.has(p.id))
    .sort((a: any, b: any) => b.qty_available - a.qty_available)
    .slice(0, 5);

  console.log(`📊 Dashboard generado: ${allProducts.length} productos, valor total: ${totalInventoryValue}`);

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
        today: posTodayStats.count,
        month: posMonthTotals.count,
        revenueToday: posRevenueToday,
        revenueMonth: posRevenueMonth,
      },
      ecommerce: {
        today: ecomTodayStats.count,
        month: ecomMonthTotals.count,
        revenueToday: ecomRevenueToday,
        revenueMonth: ecomRevenueMonth,
      },
    },
    inventory: {
      lowStock: lowStockProducts.length,
      outOfStock: outOfStockCount,
      totalValue: totalInventoryValue,
      expiringSoon: expiringProducts.length,
      totalProducts: allProducts.length,
    },
    products: {
      topSelling: topSellingProducts,
      lowStock: lowStockProducts.slice(0, 5),
      slowMoving: slowMovingProducts,
      expiring: expiringProducts,
    },
  };
}
