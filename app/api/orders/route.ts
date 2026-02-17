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

    // Filtro de estados
    const states = stateFilter === 'all'
      ? ['sale', 'done']
      : stateFilter.split(',');

    const filters: any[] = [['state', 'in', states]];

    // Obtener pedidos + total + métricas en paralelo
    const [orders, total, pendingCount, todayCount] = await Promise.all([
      odoo.getEcommerceOrders(filters, limit, offset),
      odoo.countEcommerceOrders(filters),
      odoo.countEcommerceOrders([['state', '=', 'sale']]),
      odoo.countEcommerceOrders([
        ['state', 'in', ['sale', 'done']],
        ['date_order', '>=', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()],
      ]),
    ]);

    // Monto total pendiente (solo si hay pedidos pendientes)
    let totalPendingAmount = 0;
    if (pendingCount > 0) {
      const pendingOrders = await odoo.getEcommerceOrders(
        [['state', '=', 'sale']],
        500
      );
      totalPendingAmount = pendingOrders.reduce(
        (sum, o) => sum + (o.amount_total || 0),
        0
      );
    }

    return NextResponse.json({
      orders,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
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
