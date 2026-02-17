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

    const { searchParams } = new URL(req.url);
    const stateFilter = searchParams.get('state') || 'sale';
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    const odoo = getOdooClient();

    const states = stateFilter === 'all'
      ? ['sale', 'done']
      : stateFilter.split(',');

    const filters: any[] = [['state', 'in', states]];

    // Solo 2 llamadas: pedidos de la vista actual + todos los pendientes para métricas
    const [orders, allPending] = await Promise.all([
      odoo.getEcommerceOrders(filters, limit, offset),
      odoo.getEcommerceOrders([['state', '=', 'sale']], 500),
    ]);

    // Calcular métricas desde allPending (sin llamadas extra)
    const pendingCount = allPending.length;
    const totalPendingAmount = allPending.reduce(
      (sum, o) => sum + (o.amount_total || 0),
      0
    );

    // Pedidos de hoy (filtrar en JS, no otra llamada a Odoo)
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const todayCount = allPending.filter(
      (o) => new Date(o.date_order) >= startOfDay
    ).length;

    // Total para paginación: si estamos viendo "sale", usamos allPending.length
    // Si otro filtro, estimamos con lo que tenemos
    let total: number;
    if (stateFilter === 'sale') {
      total = pendingCount;
    } else {
      // Para "done" o "all", si la página está llena hay más
      total = orders.length < limit ? offset + orders.length : offset + limit + 1;
    }

    return NextResponse.json({
      orders,
      total,
      limit,
      offset,
      hasMore: orders.length === limit,
      summary: {
        pendingCount,
        totalPendingAmount,
        todayCount,
      },
    });
  } catch (error: any) {
    console.error('Orders API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
