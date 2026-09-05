import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IMonthlySalesHistory extends Document {
  month: string; // "YYYY-MM"
  pos: number;
  ecom: number;
  total: number;
  posCount: number;
  ecomCount: number;
  posMorning?: number;
  posAfternoon?: number;
  posMorningCount?: number;
  posAfternoonCount?: number;
}

const MonthlySalesHistorySchema = new Schema<IMonthlySalesHistory>(
  {
    month: { type: String, required: true, unique: true },
    pos: { type: Number, default: 0 },
    ecom: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    posCount: { type: Number, default: 0 },
    ecomCount: { type: Number, default: 0 },
    posMorning: { type: Number },
    posAfternoon: { type: Number },
    posMorningCount: { type: Number },
    posAfternoonCount: { type: Number },
  },
  { timestamps: true }
);

MonthlySalesHistorySchema.index({ month: 1 });

const MonthlySalesHistory: Model<IMonthlySalesHistory> =
  mongoose.models.MonthlySalesHistory ||
  mongoose.model<IMonthlySalesHistory>('MonthlySalesHistory', MonthlySalesHistorySchema);

export default MonthlySalesHistory;
