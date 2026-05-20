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

    // Domain de "pendientes reales": sent sin pagar, o sale sin entrega completa.
    // Filtro aplicado en Odoo (server-side), no en JS.
    const pendingDomain: any[] = [
      '|',
      ['state', '=', 'sent'],
      '&', ['state', '=', 'sale'], ['delivery_status', '!=', 'full'],
    ];

    // Domain para la vista paginada según el filtro solicitado
    let displayFilters: any[];
    if (stateFilter === 'pending') {
      displayFilters = pendingDomain;
    } else if (stateFilter === 'all') {
      displayFilters = [['state', 'in', ['sent', 'sale', 'done']]];
    } else {
      displayFilters = [['state', 'in', stateFilter.split(',')]];
    }

    // Summary con read_group: 1 RPC → 1 fila (count + sum). No más fetch de 500 registros.
    const summaryDomain = [['website_id', '!=', false], ...pendingDomain];

    const [orders, summaryResult] = await Promise.all([
      odoo.getEcommerceOrders(displayFilters, limit, offset),
      odoo.readGroup('sale.order', summaryDomain, ['amount_total'], []),
    ]);

    const pendingCount = summaryResult[0]?.__count || 0;
    const totalPendingAmount = summaryResult[0]?.amount_total || 0;

    const total = orders.length < limit ? offset + orders.length : offset + limit + 1;

    return NextResponse.json({
      orders,
      total,
      limit,
      offset,
      hasMore: orders.length === limit,
      summary: {
        pendingCount,
        totalPendingAmount,
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
