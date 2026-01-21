import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getOdooClient } from '@/lib/odoo';
import { getGeminiService } from '@/lib/gemini';
import connectDB from '@/lib/mongodb';
import PurchaseSuggestion from '@/models/PurchaseSuggestion';

/**
 * GET - Obtener las últimas sugerencias guardadas (sin generar nuevas)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    // Buscar la última sugerencia del usuario
    const lastSuggestion = await PurchaseSuggestion.findOne({
      userId: session.user.email,
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!lastSuggestion) {
      return NextResponse.json(
        {
          lowStock: [],
          topSelling: [],
          analysis: '',
          generatedAt: null,
          message: 'No hay sugerencias generadas. Presiona "Generar" para crear un análisis.',
        },
        { status: 200 }
      );
    }

    return NextResponse.json({
      lowStock: lastSuggestion.lowStock,
      topSelling: lastSuggestion.topSelling,
      analysis: lastSuggestion.analysis,
      generatedAt: lastSuggestion.generatedAt.toISOString(),
    });
  } catch (error: any) {
    console.error('Purchase suggestions GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST - Generar nuevas sugerencias y guardarlas
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const odoo = getOdooClient();
    const gemini = getGeminiService();

    // Obtener productos con bajo stock
    const lowStock = await odoo.getLowStockProducts(10);

    // Obtener productos más vendidos
    const topSelling = await odoo.getTopSellingProducts(30, 10);

    // Obtener análisis de Gemini
    const analysis = await gemini.analyzeForPurchaseOrders(lowStock, topSelling);

    const generatedAt = new Date();

    // Guardar en la base de datos
    const suggestion = await PurchaseSuggestion.create({
      lowStock,
      topSelling,
      analysis,
      generatedAt,
      userId: session.user.email,
    });

    return NextResponse.json({
      lowStock: suggestion.lowStock,
      topSelling: suggestion.topSelling,
      analysis: suggestion.analysis,
      generatedAt: suggestion.generatedAt.toISOString(),
    });
  } catch (error: any) {
    console.error('Purchase suggestions POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
