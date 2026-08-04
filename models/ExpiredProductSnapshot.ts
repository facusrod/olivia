import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IExpiredProductSnapshotItem {
  productId: number;
  name: string;
  lotName: string;
  qty: number;
  unitCost: number;
  totalValue: number;
  expirationDate: string;
}

export interface IExpiredProductSnapshot extends Document {
  date: string; // "YYYY-MM-DD" en horario Argentina
  items: IExpiredProductSnapshotItem[];
  totalQty: number;
  totalValue: number;
  generatedAt: Date;
}

const ExpiredProductSnapshotSchema = new Schema<IExpiredProductSnapshot>(
  {
    date: { type: String, required: true, unique: true },
    items: { type: Schema.Types.Mixed, default: [] },
    totalQty: { type: Number, default: 0 },
    totalValue: { type: Number, default: 0 },
    generatedAt: { type: Date, required: true },
  },
  { timestamps: true }
);

ExpiredProductSnapshotSchema.index({ date: 1 });

const ExpiredProductSnapshot: Model<IExpiredProductSnapshot> =
  mongoose.models.ExpiredProductSnapshot ||
  mongoose.model<IExpiredProductSnapshot>('ExpiredProductSnapshot', ExpiredProductSnapshotSchema);

export default ExpiredProductSnapshot;
