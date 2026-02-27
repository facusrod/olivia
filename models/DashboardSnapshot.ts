import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IDashboardSnapshot extends Document {
  sales: {
    today: number;
    month: number;
    lastMonth: number;
    growthPercentage: number;
    averageTicket: number;
  };
  orders: {
    today: number;
    month: number;
    pos: {
      today: number;
      month: number;
      revenueToday: number;
      revenueMonth: number;
    };
    ecommerce: {
      today: number;
      month: number;
      revenueToday: number;
      revenueMonth: number;
    };
  };
  inventory: {
    lowStock: number;
    outOfStock: number;
    totalValue: number;
    expiringSoon: number;
    totalProducts: number;
  };
  products: {
    topSelling: Array<{ id: number; name: string; totalQty: number }>;
    lowStock: Array<{ id: number; name: string; qty_available: number; list_price: number }>;
    expiring: Array<{
      id: number;
      name: string;
      totalQty: number;
      expirationDate: string;
      lotName: string;
      daysUntilExpiration: number;
    }>;
  };
  generatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DashboardSnapshotSchema = new Schema<IDashboardSnapshot>(
  {
    sales: {
      today: { type: Number, default: 0 },
      month: { type: Number, default: 0 },
      lastMonth: { type: Number, default: 0 },
      growthPercentage: { type: Number, default: 0 },
      averageTicket: { type: Number, default: 0 },
    },
    orders: {
      today: { type: Number, default: 0 },
      month: { type: Number, default: 0 },
      pos: {
        today: { type: Number, default: 0 },
        month: { type: Number, default: 0 },
        revenueToday: { type: Number, default: 0 },
        revenueMonth: { type: Number, default: 0 },
      },
      ecommerce: {
        today: { type: Number, default: 0 },
        month: { type: Number, default: 0 },
        revenueToday: { type: Number, default: 0 },
        revenueMonth: { type: Number, default: 0 },
      },
    },
    inventory: {
      lowStock: { type: Number, default: 0 },
      outOfStock: { type: Number, default: 0 },
      totalValue: { type: Number, default: 0 },
      expiringSoon: { type: Number, default: 0 },
      totalProducts: { type: Number, default: 0 },
    },
    products: {
      topSelling: { type: Schema.Types.Mixed, default: [] },
      lowStock: { type: Schema.Types.Mixed, default: [] },
      expiring: { type: Schema.Types.Mixed, default: [] },
    },
    generatedAt: { type: Date, required: true },
  },
  {
    timestamps: true,
  }
);

// Índice para obtener rápidamente el último snapshot
DashboardSnapshotSchema.index({ generatedAt: -1 });

const DashboardSnapshot: Model<IDashboardSnapshot> =
  mongoose.models.DashboardSnapshot ||
  mongoose.model<IDashboardSnapshot>('DashboardSnapshot', DashboardSnapshotSchema);

export default DashboardSnapshot;
