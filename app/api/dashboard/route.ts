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

    if (lastSnapshot) {
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

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  // Ejecutar consultas en paralelo
  const [
    lowStockProducts,
    topSellingProducts,
    expiringProducts,
    allProducts,
    todayOrders,
    monthOrders,
    lastMonthOrders,
  ] = await Promise.all([
    odoo.getLowStockProducts(10),
    odoo.getTopSellingProducts(30, 5),
    odoo.getExpiringProducts(30, 10),
    // ⚡ Ahora pagina automáticamente para obtener TODOS los productos
    odoo.getAllProducts([]),
    odoo.getOrders([
      ['date_order', '>=', startOfDay.toISOString()],
      ['state', 'in', ['sale', 'done', 'paid', 'invoiced']],
    ]),
    odoo.getOrders([
      ['date_order', '>=', startOfMonth.toISOString()],
      ['state', 'in', ['sale', 'done', 'paid', 'invoiced']],
    ]),
    odoo.getOrders([
      ['date_order', '>=', startOfLastMonth.toISOString()],
      ['date_order', '<=', endOfLastMonth.toISOString()],
      ['state', 'in', ['sale', 'done', 'paid', 'invoiced']],
    ]),
  ]);

  // Calcular métricas de ventas
  const todayRevenue = todayOrders.reduce((sum: number, order: any) => sum + (order.amount_total || 0), 0);
  const monthRevenue = monthOrders.reduce((sum: number, order: any) => sum + (order.amount_total || 0), 0);
  const lastMonthRevenue = lastMonthOrders.reduce((sum: number, order: any) => sum + (order.amount_total || 0), 0);

  const growthPercentage = lastMonthRevenue > 0
    ? ((monthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
    : 0;

  const averageTicket = monthOrders.length > 0
    ? monthRevenue / monthOrders.length
    : 0;

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
      today: todayOrders.length,
      month: monthOrders.length,
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
