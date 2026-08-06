import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import NotifiedOrder from '@/models/NotifiedOrder';
import { sendPushToAll } from '@/lib/push';

/**
 * Odoo serializa campos many2one como [id, "display_name"] o, según el
 * mecanismo de webhook usado, como valor plano — soportamos ambas formas.
 */
function displayName(value: unknown): string | null {
  if (Array.isArray(value) && typeof value[1] === 'string') return value[1];
  if (typeof value === 'string') return value;
  return null;
}

function formatCurrency(amount: unknown): string {
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount));
  if (Number.isNaN(num)) return '';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(num);
}

export async function POST(req: NextRequest) {
  const secret = process.env.ODOO_WEBHOOK_SECRET;
  const authHeader = req.headers.get('authorization');
  const querySecret = req.nextUrl.searchParams.get('secret');
  const providedSecret = authHeader?.replace(/^Bearer\s+/i, '') || querySecret;

  if (!secret || providedSecret !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  console.log(
    '[webhooks/odoo] payload recibido:',
    JSON.stringify(payload),
    '| auth via:', authHeader ? 'header' : querySecret ? 'query param' : 'ninguno'
  );

  const orderId = payload.id ?? payload.order_id;
  if (orderId === undefined || orderId === null) {
    return NextResponse.json({ error: 'Missing order id' }, { status: 400 });
  }
  const numericOrderId = Number(orderId);
  if (Number.isNaN(numericOrderId)) {
    return NextResponse.json({ error: 'Invalid order id' }, { status: 400 });
  }

  await connectDB();

  try {
    await NotifiedOrder.create({ orderId: numericOrderId });
  } catch (error: any) {
    if (error?.code === 11000) {
      // Ya notificado para este pedido (reintento de Odoo) - no reenviar.
      return NextResponse.json({ ok: true, deduped: true });
    }
    throw error;
  }

  const orderName = typeof payload.name === 'string' ? payload.name : `#${numericOrderId}`;
  const partnerName = displayName(payload.partner_id);
  const amount = formatCurrency(payload.amount_total);

  const bodyParts = [partnerName, amount].filter(Boolean);

  await sendPushToAll({
    title: `Nuevo pedido pendiente: ${orderName}`,
    body: bodyParts.length > 0 ? bodyParts.join(' · ') : 'Requiere tu atención',
    url: `/orders/${numericOrderId}`,
  });

  return NextResponse.json({ ok: true });
}
