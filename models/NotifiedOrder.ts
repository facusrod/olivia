import mongoose, { Schema, Document, Model } from 'mongoose';

export interface INotifiedOrder extends Document {
  orderId: number;
  notifiedAt: Date;
}

const NotifiedOrderSchema = new Schema<INotifiedOrder>({
  orderId: { type: Number, required: true, unique: true },
  notifiedAt: { type: Date, required: true, default: Date.now },
});

const NotifiedOrder: Model<INotifiedOrder> =
  mongoose.models.NotifiedOrder ||
  mongoose.model<INotifiedOrder>('NotifiedOrder', NotifiedOrderSchema);

export default NotifiedOrder;
