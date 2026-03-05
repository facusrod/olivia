import mongoose, { Schema, Document } from 'mongoose';

export interface IProductEmbedding extends Document {
  odooId: number;
  name: string;
  listPrice: number;
  qtyAvailable: number;
  categId: number;
  categName: string;
  defaultCode: string;
  barcode: string;
  descriptionSale: string;
  embeddingText: string;
  embedding: number[];
  lastSyncedAt: Date;
}

const ProductEmbeddingSchema = new Schema<IProductEmbedding>({
  odooId: { type: Number, required: true, unique: true },
  name: { type: String, required: true },
  listPrice: { type: Number, default: 0 },
  qtyAvailable: { type: Number, default: 0 },
  categId: { type: Number, default: 0 },
  categName: { type: String, default: '' },
  defaultCode: { type: String, default: '' },
  barcode: { type: String, default: '' },
  descriptionSale: { type: String, default: '' },
  embeddingText: { type: String, required: true },
  embedding: { type: [Number], required: true },
  lastSyncedAt: { type: Date, default: Date.now },
});

export default mongoose.models.ProductEmbedding ||
  mongoose.model<IProductEmbedding>('ProductEmbedding', ProductEmbeddingSchema);
