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
 * POST - Regenera el dashboard: calcula todo desde Odoo y guarda nuevo snapshot.
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
 * Usa getAllProducts para paginar y obtener los 900+ productos.
 */
async function generateDashboardData() {
  const odoo = getOdooClient();

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

  // Ejecutar consultas en paralelo (POS + Ecommerce + Inventario)
  const [
    lowStockProducts,
    topSellingProducts,
    expiringProducts,
    allProducts,
    todayOrders,
    monthOrders,
    lastMonthOrders,
    ecommerceTodayOrders,
    ecommerceMonthOrders,
    ecommerceLastMonthOrders,
  ] = await Promise.all([
    odoo.getLowStockProducts(10),
    odoo.getTopSellingProducts(30, 5),
    odoo.getExpiringProducts(30, 10),
    odoo.getAllProducts([]),
    // POS orders (paginado para traer todas)
    odoo.getAllOrders([
      ['date_order', '>=', startOfDay.toISOString()],
      ['state', 'in', confirmedStates],
    ]),
    odoo.getAllOrders([
      ['date_order', '>=', startOfMonth.toISOString()],
      ['state', 'in', confirmedStates],
    ]),
    odoo.getAllOrders([
      ['date_order', '>=', startOfLastMonth.toISOString()],
      ['date_order', '<=', endOfLastMonth.toISOString()],
      ['state', 'in', confirmedStates],
    ]),
    // Ecommerce orders (paginado para traer todas)
    odoo.getAllEcommerceOrders([
      ['date_order', '>=', startOfDay.toISOString()],
      ['state', 'in', confirmedStates],
    ]),
    odoo.getAllEcommerceOrders([
      ['date_order', '>=', startOfMonth.toISOString()],
      ['state', 'in', confirmedStates],
    ]),
    odoo.getAllEcommerceOrders([
      ['date_order', '>=', startOfLastMonth.toISOString()],
      ['date_order', '<=', endOfLastMonth.toISOString()],
      ['state', 'in', confirmedStates],
    ]),
  ]);

  // Calcular revenue por canal
  const posRevenueToday = todayOrders.reduce((sum: number, order: any) => sum + (order.amount_total || 0), 0);
  const posRevenueMonth = monthOrders.reduce((sum: number, order: any) => sum + (order.amount_total || 0), 0);
  const posRevenueLastMonth = lastMonthOrders.reduce((sum: number, order: any) => sum + (order.amount_total || 0), 0);

  const ecomRevenueToday = ecommerceTodayOrders.reduce((sum: number, order: any) => sum + (order.amount_total || 0), 0);
  const ecomRevenueMonth = ecommerceMonthOrders.reduce((sum: number, order: any) => sum + (order.amount_total || 0), 0);
  const ecomRevenueLastMonth = ecommerceLastMonthOrders.reduce((sum: number, order: any) => sum + (order.amount_total || 0), 0);

  // Totales combinados
  const todayRevenue = posRevenueToday + ecomRevenueToday;
  const monthRevenue = posRevenueMonth + ecomRevenueMonth;
  const lastMonthRevenue = posRevenueLastMonth + ecomRevenueLastMonth;

  const totalOrdersToday = todayOrders.length + ecommerceTodayOrders.length;
  const totalOrdersMonth = monthOrders.length + ecommerceMonthOrders.length;

  const growthPercentage = lastMonthRevenue > 0
    ? ((monthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
    : 0;

  const averageTicket = totalOrdersMonth > 0
    ? monthRevenue / totalOrdersMonth
    : 0;

  // Debug
  console.log('🔍 Dashboard debug:', {
    pos: { today: todayOrders.length, month: monthOrders.length },
    ecommerce: { today: ecommerceTodayOrders.length, month: ecommerceMonthOrders.length },
    revenue: { posToday: posRevenueToday, ecomToday: ecomRevenueToday, total: todayRevenue },
  });

  // Métricas de inventario (ahora con TODOS los productos)
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
        today: todayOrders.length,
        month: monthOrders.length,
        revenueToday: posRevenueToday,
        revenueMonth: posRevenueMonth,
      },
      ecommerce: {
        today: ecommerceTodayOrders.length,
        month: ecommerceMonthOrders.length,
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
