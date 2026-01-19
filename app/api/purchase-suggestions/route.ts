import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getOdooClient } from '@/lib/odoo';
import { getGeminiService } from '@/lib/gemini';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const odoo = getOdooClient();
    const gemini = getGeminiService();

    // Obtener productos con bajo stock
    const lowStock = await odoo.getLowStockProducts(10);

    // Obtener productos más vendidos
    const topSelling = await odoo.getTopSellingProducts(30, 10);

    // Obtener análisis de Gemini
    const analysis = await gemini.analyzeForPurchaseOrders(lowStock, topSelling);

    return NextResponse.json({
      lowStock,
      topSelling,
      analysis,
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Purchase suggestions API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
