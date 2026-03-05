import { GoogleGenerativeAI } from '@google/generative-ai';
import connectDB from './mongodb';
import ProductEmbedding from '@/models/ProductEmbedding';
import { getOdooClient } from './odoo';
import type { OdooProduct } from './odoo';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

class EmbeddingService {
  private model;

  constructor() {
    this.model = genAI.getGenerativeModel({ model: 'embedding-001' });
  }

  async embedText(text: string): Promise<number[]> {
    const result = await this.model.embedContent(text);
    return result.embedding.values;
  }

  async searchSimilarProducts(query: string, limit = 15): Promise<OdooProduct[]> {
    await connectDB();
    const queryEmbedding = await this.embedText(query);

    const results = await ProductEmbedding.aggregate([
      {
        $vectorSearch: {
          index: 'product_vector_index',
          path: 'embedding',
          queryVector: queryEmbedding,
          numCandidates: limit * 10,
          limit,
        },
      },
      {
        $project: {
          odooId: 1,
          name: 1,
          listPrice: 1,
          qtyAvailable: 1,
          categId: 1,
          categName: 1,
          defaultCode: 1,
        },
      },
    ]);

    return results.map((r: any) => ({
      id: r.odooId,
      name: r.name,
      list_price: r.listPrice,
      qty_available: r.qtyAvailable,
      categ_id: [r.categId, r.categName] as [number, string],
      default_code: r.defaultCode,
    }));
  }

  async syncAllProducts(): Promise<{ synced: number; errors: number }> {
    await connectDB();
    const odoo = getOdooClient();

    const products = await odoo.getProducts([['active', '=', true]], 1000);

    let synced = 0;
    let errors = 0;
    const CHUNK_SIZE = 50; // 50 para no saturar la API de embeddings

    for (let i = 0; i < products.length; i += CHUNK_SIZE) {
      const chunk = products.slice(i, i + CHUNK_SIZE);

      const texts = chunk.map((p) => {
        const parts = [p.name];
        if (p.categ_id?.[1]) parts.push(`Categoria: ${p.categ_id[1]}`);
        if (p.description_sale) parts.push(p.description_sale);
        if (p.default_code) parts.push(`Codigo: ${p.default_code}`);
        return parts.join('. ');
      });

      try {
        const embeddings: number[][] = [];
        for (const text of texts) {
          embeddings.push(await this.embedText(text));
        }

        const ops = chunk.map((p, idx) => ({
          updateOne: {
            filter: { odooId: p.id },
            update: {
              $set: {
                odooId: p.id,
                name: p.name,
                listPrice: p.list_price || 0,
                qtyAvailable: p.qty_available || 0,
                categId: p.categ_id?.[0] || 0,
                categName: p.categ_id?.[1] || '',
                defaultCode: p.default_code || '',
                barcode: p.barcode || '',
                descriptionSale: p.description_sale || '',
                embeddingText: texts[idx],
                embedding: embeddings[idx],
                lastSyncedAt: new Date(),
              },
            },
            upsert: true,
          },
        }));

        await ProductEmbedding.bulkWrite(ops);
        synced += chunk.length;
        console.log(`Sync progress: ${synced}/${products.length}`);
      } catch (err) {
        console.error(`Error in chunk ${i}-${i + CHUNK_SIZE}:`, err);
        errors += chunk.length;
      }
    }

    return { synced, errors };
  }

  async syncStockOnly(): Promise<{ updated: number }> {
    await connectDB();
    const odoo = getOdooClient();

    const products = await odoo.getProducts([['active', '=', true]], 1000);

    const ops = products.map((p) => ({
      updateOne: {
        filter: { odooId: p.id },
        update: {
          $set: {
            listPrice: p.list_price || 0,
            qtyAvailable: p.qty_available || 0,
            lastSyncedAt: new Date(),
          },
        },
      },
    }));

    const result = await ProductEmbedding.bulkWrite(ops);
    return { updated: result.modifiedCount };
  }
}

// Singleton
let embeddingService: EmbeddingService | null = null;

export function getEmbeddingService(): EmbeddingService {
  if (!embeddingService) {
    embeddingService = new EmbeddingService();
  }
  return embeddingService;
}
