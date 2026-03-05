import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getEmbeddingService } from '@/lib/embedding';
import { invalidateCache } from '@/lib/cache';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { mode } = await req.json();

    const embeddingService = getEmbeddingService();

    if (mode === 'stock-only') {
      const result = await embeddingService.syncStockOnly();
      return NextResponse.json({ ok: true, mode: 'stock-only', ...result });
    }

    // full sync (default)
    const result = await embeddingService.syncAllProducts();
    invalidateCache();
    return NextResponse.json({ ok: true, mode: 'full', ...result });
  } catch (error: any) {
    console.error('Embeddings sync error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
