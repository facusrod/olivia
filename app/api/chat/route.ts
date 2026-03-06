import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import connectDB from '@/lib/mongodb';
import Conversation from '@/models/Conversation';
import User from '@/models/User';
import { getGeminiService } from '@/lib/gemini';
import { getOdooClient } from '@/lib/odoo';
import { getCachedLowStock, getCachedTopSellers } from '@/lib/cache';

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
      // Convertir historial para Gemini (últimos 15 mensajes)
      history = conversation.messages.slice(-15).map((msg) => ({
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
        const [products, lowStock, { topSelling }] = await Promise.all([
          odoo.searchProducts(message.slice(0, 50)),
          getCachedLowStock(() => odoo.getLowStockProducts(10)),
          getCachedTopSellers(() => odoo.getProductSalesRanking(30, 10, 0)),
        ]);
        context = { products, lowStock, recentSales: topSelling };
      } catch (error) {
        console.error('Error loading context:', error);
      }
    }

    const encoder = new TextEncoder();
    let fullResponse = '';

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of gemini.chatStream(message, history, context)) {
            fullResponse += chunk;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk })}\n\n`));
          }

          // Guardar conversación completa
          conversation.messages.push({ role: 'user', content: message, timestamp: new Date() });
          conversation.messages.push({ role: 'assistant', content: fullResponse, timestamp: new Date() });
          await conversation.save();

          // Tracking de uso
          User.updateOne(
            { _id: session.user.dbId },
            { $inc: { 'usage.totalMessages': 1 }, $set: { 'usage.lastActiveAt': new Date() } }
          ).catch((err: any) => console.error('Error updating usage:', err));

          // Enviar metadata final
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ done: true, conversationId: conversation._id.toString(), title: conversation.title })}\n\n`
            )
          );
        } catch (error: any) {
          console.error('Stream error:', error);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: error.message || 'Error interno' })}\n\n`)
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
