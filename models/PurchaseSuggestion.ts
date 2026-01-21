import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IProduct {
  id: number;
  name: string;
  list_price: number;
  qty_available: number;
}

export interface ITopSelling {
  id: number;
  name: string;
  totalQty: number;
}

export interface IPurchaseSuggestion extends Document {
  lowStock: IProduct[];
  topSelling: ITopSelling[];
  analysis: string;
  generatedAt: Date;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema({
  id: { type: Number, required: true },
  name: { type: String, required: true },
  list_price: { type: Number, required: true },
  qty_available: { type: Number, required: true },
}, { _id: false });

const TopSellingSchema = new Schema({
  id: { type: Number, required: true },
  name: { type: String, required: true },
  totalQty: { type: Number, required: true },
}, { _id: false });

const PurchaseSuggestionSchema = new Schema<IPurchaseSuggestion>(
  {
    lowStock: { type: [ProductSchema], required: true },
    topSelling: { type: [TopSellingSchema], required: true },
    analysis: { type: String, required: true },
    generatedAt: { type: Date, required: true },
    userId: { type: String, required: true, index: true },
  },
  {
    timestamps: true,
  }
);

// Índice para obtener rápidamente la última sugerencia por usuario
PurchaseSuggestionSchema.index({ userId: 1, createdAt: -1 });

// Prevenir modelo duplicado en desarrollo (hot reload)
const PurchaseSuggestion: Model<IPurchaseSuggestion> =
  mongoose.models.PurchaseSuggestion ||
  mongoose.model<IPurchaseSuggestion>('PurchaseSuggestion', PurchaseSuggestionSchema);

export default PurchaseSuggestion;
