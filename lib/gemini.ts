import { GoogleGenerativeAI } from '@google/generative-ai';
import { OdooProduct } from './odoo';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export interface ChatMessage {
  role: 'user' | 'model';
  parts: string;
}

export interface ChatContext {
  products?: OdooProduct[];
  recentSales?: any[];
  lowStock?: OdooProduct[];
}

class GeminiService {
  private model;

  constructor() {
    this.model = genAI.getGenerativeModel({
      model: 'gemini-3-flash-preview',
    });
  }

  private buildSystemPrompt(context?: ChatContext): string {
    let prompt = `Eres OlivIA, un asistente virtual inteligente para una tienda boutique de productos saludables.
      Tu misión es ayudar a los empleados de la tienda a:
      1. Responder consultas de clientes sobre productos (dietas Keto, veganas, sin gluten, etc.)
      2. Buscar productos específicos en el inventario
      3. Analizar ventas y sugerir órdenes de compra
      4. Proporcionar información sobre stock disponible
      IMPORTANTE: Solo proporciona información basada en los datos del inventario proporcionados a continuación. No inventes productos, precios o información que no esté en los datos. Si no tienes datos específicos, indica claramente que no tienes acceso al inventario y sugiere verificar directamente en el sistema.
      `;
    if (context?.products && context.products.length > 0) {
      prompt += `\n\n=== PRODUCTOS DISPONIBLES ===\n`;
      prompt += context.products
        .slice(0, 20)
        .map(
          (p) =>
            `- ${p.name} (ID: ${p.id}, Precio: $${p.list_price}, Stock: ${p.qty_available})`
        )
        .join('\n');
    }

    if (context?.lowStock && context.lowStock.length > 0) {
      prompt += `\n\n=== PRODUCTOS CON BAJO STOCK ===\n`;
      prompt += context.lowStock
        .map(
          (p) =>
            `- ${p.name} (Stock: ${p.qty_available}, Precio: $${p.list_price})`
        )
        .join('\n');
    }

    if (context?.recentSales && context.recentSales.length > 0) {
      prompt += `\n\n=== PRODUCTOS MÁS VENDIDOS (últimos 30 días) ===\n`;
      prompt += context.recentSales
        .slice(0, 10)
        .map((s) => `- ${s.name} (Vendidos: ${s.totalQty})`)
        .join('\n');
    }

    // Si no hay contexto o datos, agregar nota
    if (!context || (!context.products?.length && !context.lowStock?.length && !context.recentSales?.length)) {
      prompt += `\n\nNOTA: Actualmente no tengo acceso a los datos del inventario. Solo puedo proporcionar información general sobre productos saludables. Para información específica sobre productos disponibles, stock o precios, por favor verifica directamente en el sistema de inventario.`;
    }

    return prompt;
  }

  async chat(
    userMessage: string,
    history: ChatMessage[] = [],
    context?: ChatContext
  ): Promise<string> {
    try {
      const systemPrompt = this.buildSystemPrompt(context);

      // Iniciar chat con historial
      const chat = this.model.startChat({
        history: [
          {
            role: 'user',
            parts: [{ text: systemPrompt }],
          },
          {
            role: 'model',
            parts: [{ text: '¡Hola! Soy OlivIA, tu asistente para la tienda. ¿En qué puedo ayudarte hoy?' }],
          },
          ...history.map((msg) => ({
            role: msg.role,
            parts: [{ text: msg.parts }],
          })),
        ],
        generationConfig: {
          maxOutputTokens: 1000,
          temperature: 0.7,
        },
      });

      const result = await chat.sendMessage(userMessage);
      const response = await result.response;
      return response.text();
    } catch (error: any) {
      console.error('Gemini chat error:', error);
      throw new Error(`Error al procesar el mensaje: ${error.message}`);
    }
  }

  async analyzeForPurchaseOrders(
    lowStock: OdooProduct[],
    topSelling: any[]
  ): Promise<string> {
    try {
      const prompt = `Analiza la siguiente información de la tienda y sugiere órdenes de compra:
        === PRODUCTOS CON BAJO STOCK ===
        ${lowStock.map((p) => `- ${p.name}: ${p.qty_available} unidades, Precio: $${p.list_price}`).join('\n')}

        === PRODUCTOS MÁS VENDIDOS (últimos 30 días) ===
        ${topSelling.map((s) => `- ${s.name}: ${s.totalQty} unidades vendidas`).join('\n')}

        Por favor, proporciona:
        1. Lista de productos que deberían reponerse urgentemente
        2. Cantidad sugerida para cada producto (basada en ventas y stock actual)
        3. Prioridad (Alta/Media/Baja)
        4. Justificación breve para cada sugerencia
        Formato de respuesta en lista clara y concisa.`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error: any) {
      console.error('Gemini analysis error:', error);
      throw new Error(`Error al analizar datos: ${error.message}`);
    }
  }

  async searchProductsByIntent(query: string): Promise<{
    searchTerms: string[];
    category?: string;
    filters?: string[];
  }> {
    try {
      const prompt = `Analiza la siguiente consulta de un cliente y extrae información para buscar productos:
        Consulta: "${query}"

        Extrae:
        1. Términos de búsqueda principales (palabras clave)
        2. Categoría o tipo de producto (si se menciona: "keto", "vegano", "sin gluten", "orgánico", etc.)
        3. Filtros especiales (precio, marca, etc.)

        Responde SOLO en formato JSON con esta estructura:
        {
          "searchTerms": ["término1", "término2"],
          "category": "categoría si aplica",
          "filters": ["filtro1 si aplica"]
        }`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Intentar parsear JSON de la respuesta
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // Fallback si no hay JSON válido
      return {
        searchTerms: [query],
        category: undefined,
        filters: [],
      };
    } catch (error: any) {
      console.error('Gemini intent parsing error:', error);
      // Fallback simple
      return {
        searchTerms: [query],
        category: undefined,
        filters: [],
      };
    }
  }
}

// Singleton instance
let geminiService: GeminiService | null = null;

export function getGeminiService(): GeminiService {
  if (!geminiService) {
    geminiService = new GeminiService();
  }
  return geminiService;
}
