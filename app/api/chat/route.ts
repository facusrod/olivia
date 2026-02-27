import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import connectDB from '@/lib/mongodb';
import Conversation from '@/models/Conversation';
import User from '@/models/User';
import { getGeminiService } from '@/lib/gemini';
import { getOdooClient } from '@/lib/odoo';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { message, conversationId, includeContext } = await req.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    await connectDB();
    const gemini = getGeminiService();
    const odoo = getOdooClient();

    let conversation;
    let history: any[] = [];

    // Obtener o crear conversación
    if (conversationId) {
      conversation = await Conversation.findById(conversationId);
      if (!conversation || conversation.userId !== session.user.dbId) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
      }
      // Convertir historial para Gemini
      history = conversation.messages.map((msg) => ({
        role: msg.role === 'assistant' ? 'model' : msg.role,
        parts: msg.content,
      }));
    } else {
      // Crear nueva conversación
      conversation = new Conversation({
        userId: session.user.dbId,
        title: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
        messages: [],
      });
    }

    // Obtener contexto si se solicita
    let context = undefined;
    if (includeContext) {
      try {
        // Analizar intención del mensaje
        const intent = await gemini.searchProductsByIntent(message);

        // Buscar productos relevantes
        let products: any[] = [];
        if (intent.searchTerms.length > 0) {
          products = await odoo.searchProducts(intent.searchTerms[0]);
        }

        // Obtener productos con bajo stock
        const lowStock = await odoo.getLowStockProducts(10);

        // Obtener productos más vendidos
        const { topSelling } = await odoo.getProductSalesRanking(30, 10, 0);

        context = {
          products,
          lowStock,
          recentSales: topSelling,
        };
      } catch (error) {
        console.error('Error loading context:', error);
        // Continuar sin contexto si hay error
      }
    }
    console.log('Chat context:', JSON.stringify(context));

    const response = await gemini.chat(message, history, context);

    // Guardar mensajes en la conversación
    conversation.messages.push({
      role: 'user',
      content: message,
      timestamp: new Date(),
    });

    conversation.messages.push({
      role: 'assistant',
      content: response,
      timestamp: new Date(),
    });

    await conversation.save();

    // Tracking de uso
    User.updateOne(
      { _id: session.user.dbId },
      {
        $inc: { 'usage.totalMessages': 1 },
        $set: { 'usage.lastActiveAt': new Date() },
      }
    ).catch((err: any) => console.error('Error updating usage:', err));

    return NextResponse.json({
      response,
      conversationId: conversation._id.toString(),
      title: conversation.title,
    });
  } catch (error: any) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
