import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import connectDB from '@/lib/mongodb';
import PushSubscription from '@/models/PushSubscription';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { endpoint, keys } = body || {};

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
  }

  await connectDB();

  await PushSubscription.findOneAndUpdate(
    { endpoint },
    {
      endpoint,
      keys: { p256dh: keys.p256dh, auth: keys.auth },
      userId: session.user.dbId || null,
      userAgent: req.headers.get('user-agent') || null,
    },
    { upsert: true }
  );

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { endpoint } = await req.json();
  if (!endpoint) {
    return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 });
  }

  await connectDB();
  await PushSubscription.deleteOne({ endpoint });

  return NextResponse.json({ ok: true });
}
