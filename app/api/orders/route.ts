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
    const stateFilter = searchParams.get('state') || 'sent';
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    const odoo = getOdooClient();

    // Mapeo de filtros de estado
    const states = stateFilter === 'all'
      ? ['sent', 'sale', 'done']
      : stateFilter.split(',');

    const filters: any[] = [['state', 'in', states]];

    // Solo 2 llamadas: pedidos de la vista actual + todos los pendientes (sent+sale) para métricas
    const [orders, allPending] = await Promise.all([
      odoo.getEcommerceOrders(filters, limit, offset),
      odoo.getEcommerceOrders([['state', 'in', ['sent', 'sale']]], 500),
    ]);

    // Filtrar: excluir pedidos 'sale' que ya fueron entregados completamente
    const trulyPending = allPending.filter((o) => {
      if (o.state === 'sent') return true; // Sin pagar siempre es pendiente
      if (o.state === 'sale' && o.delivery_status === 'full') return false; // Pagado + entregado = no pendiente
      return true;
    });

    // Calcular métricas desde trulyPending (sin llamadas extra)
    const pendingCount = trulyPending.length;

    // Pedidos de hoy (filtrar en JS, no otra llamada a Odoo)
    // Medianoche Argentina (UTC-3) = 03:00 UTC
    const ART_OFFSET = 3;
    const now = new Date();
    const todayArg = new Date(now.getTime() - ART_OFFSET * 3600000);
    const startOfDay = new Date(Date.UTC(
      todayArg.getUTCFullYear(), todayArg.getUTCMonth(), todayArg.getUTCDate(),
      ART_OFFSET, 0, 0
    ));
    const todayCount = allPending.filter(
      (o) => new Date(o.date_order) >= startOfDay
    ).length;

    // Total para paginación
    let total: number;
    if (stateFilter === 'sent' || stateFilter === 'sale') {
      // Para sent o sale, filtramos en JS desde allPending
      total = allPending.filter((o) => states.includes(o.state)).length;
    } else {
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
