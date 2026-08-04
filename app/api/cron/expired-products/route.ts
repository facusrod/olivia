import { NextRequest, NextResponse } from 'next/server';
import { getOdooClient } from '@/lib/odoo';
import connectDB from '@/lib/mongodb';
import ExpiredProductSnapshot from '@/models/ExpiredProductSnapshot';

/**
 * Vercel Cron: saca una "foto" diaria de los productos vencidos (o que vencen hoy)
 * y la guarda de forma inmutable en Mongo, keyeada por fecha (upsert).
 *
 * Necesario porque en Odoo los lotes vencidos se descartan físicamente y
 * desaparecen de stock.lot — si no persistimos esto acá, se pierde para siempre.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectDB();

  const odoo = getOdooClient();

  // daysThreshold=0 → incluye expiration_date/use_date/removal_date <= hoy.
  // Filtro adicional por las dudas de algún borde de huso horario.
  const expired = (await odoo.getExpiringProducts(0, 1000)).filter(
    (p) => p.daysUntilExpiration <= 0
  );

  // Argentina = UTC-3. Misma convención que generateDashboardData en /api/dashboard.
  const ART_OFFSET = 3;
  const todayArg = new Date(Date.now() - ART_OFFSET * 3600000);
  const date = todayArg.toISOString().split('T')[0];

  const items = expired.map((p) => ({
    productId: p.id,
    name: p.name,
    category: p.category,
    lotName: p.lotName,
    qty: p.totalQty,
    unitCost: p.totalQty > 0 ? p.totalValue / p.totalQty : 0,
    totalValue: p.totalValue,
    expirationDate: p.expirationDate,
  }));

  const totalQty = items.reduce((sum, i) => sum + i.qty, 0);
  const totalValue = items.reduce((sum, i) => sum + i.totalValue, 0);

  const snapshot = await ExpiredProductSnapshot.findOneAndUpdate(
    { date },
    { date, items, totalQty, totalValue, generatedAt: new Date() },
    { upsert: true, new: true }
  );

  return NextResponse.json({
    date: snapshot.date,
    itemCount: snapshot.items.length,
    totalQty: snapshot.totalQty,
    totalValue: snapshot.totalValue,
  });
}
