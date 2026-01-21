import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getOdooClient } from '@/lib/odoo';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const odoo = getOdooClient();

    // Obtener fecha actual
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Ejecutar todas las consultas en paralelo
    const [
      lowStockProducts,
      topSellingProducts,
      allProducts,
      todayOrders,
      monthOrders,
      lastMonthOrders,
    ] = await Promise.all([
      // Productos con bajo stock (threshold de 10)
      odoo.getLowStockProducts(10),

      // Top 5 productos más vendidos (últimos 30 días)
      odoo.getTopSellingProducts(30, 5),

      // Todos los productos para calcular inventario
      odoo.getProducts([]),

      // Órdenes de hoy
      odoo.getOrders([
        ['date_order', '>=', startOfDay.toISOString()],
        ['state', 'in', ['sale', 'done', 'paid', 'invoiced']],
      ]),

      // Órdenes del mes actual
      odoo.getOrders([
        ['date_order', '>=', startOfMonth.toISOString()],
        ['state', 'in', ['sale', 'done', 'paid', 'invoiced']],
      ]),

      // Órdenes del mes pasado (para comparación)
      odoo.getOrders([
        ['date_order', '>=', startOfLastMonth.toISOString()],
        ['date_order', '<=', endOfLastMonth.toISOString()],
        ['state', 'in', ['sale', 'done', 'paid', 'invoiced']],
      ]),
    ]);

    // Calcular métricas de ventas
    const todayRevenue = todayOrders.reduce((sum, order) => sum + (order.amount_total || 0), 0);
    const monthRevenue = monthOrders.reduce((sum, order) => sum + (order.amount_total || 0), 0);
    const lastMonthRevenue = lastMonthOrders.reduce((sum, order) => sum + (order.amount_total || 0), 0);

    // Calcular crecimiento vs mes anterior
    const growthPercentage = lastMonthRevenue > 0
      ? ((monthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
      : 0;

    // Ticket promedio del mes
    const averageTicket = monthOrders.length > 0
      ? monthRevenue / monthOrders.length
      : 0;

    // Métricas de inventario
    const outOfStockCount = allProducts.filter(p => p.qty_available <= 0).length;
    const totalInventoryValue = allProducts.reduce(
      (sum, p) => sum + (p.list_price * p.qty_available),
      0
    );

    // Productos con menos movimiento (los que tienen stock pero no están en top selling)
    const topSellingIds = new Set(topSellingProducts.map(p => p.id));
    const slowMovingProducts = allProducts
      .filter(p => p.qty_available > 0 && !topSellingIds.has(p.id))
      .sort((a, b) => b.qty_available - a.qty_available)
      .slice(0, 5);

    return NextResponse.json({
      sales: {
        today: todayRevenue,
        month: monthRevenue,
        lastMonth: lastMonthRevenue,
        growthPercentage,
        averageTicket,
      },
      orders: {
        today: todayOrders.length,
        month: monthOrders.length,
      },
      inventory: {
        lowStock: lowStockProducts.length,
        outOfStock: outOfStockCount,
        totalValue: totalInventoryValue,
      },
      products: {
        topSelling: topSellingProducts,
        lowStock: lowStockProducts.slice(0, 5),
        slowMoving: slowMovingProducts,
      },
      updatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Dashboard API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
