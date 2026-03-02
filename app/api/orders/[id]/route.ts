import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getOdooClient } from '@/lib/odoo';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orderId = parseInt(params.id);
    if (isNaN(orderId)) {
      return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 });
    }

    const odoo = getOdooClient();

    const order = await odoo.getEcommerceOrderById(orderId);
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Fetch order lines + shipping address in parallel
    const shippingPartnerId = order.partner_shipping_id
      ? order.partner_shipping_id[0]
      : order.partner_id[0];

    const [lines, shippingAddress] = await Promise.all([
      odoo.getEcommerceOrderLines(orderId),
      odoo.getPartnerAddress(shippingPartnerId),
    ]);

    return NextResponse.json({ order, lines, shippingAddress });
  } catch (error: any) {
    console.error('Order detail API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
