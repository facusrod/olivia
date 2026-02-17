import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IUser extends Document {
  email: string;
  name: string;
  googleId?: string;
  role: 'admin' | 'user';
  isActive: boolean;
  usage: {
    totalMessages: number;
    totalConversations: number;
    lastActiveAt?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
  },
  name: {
    type: String,
    default: '',
  },
  googleId: {
    type: String,
    default: null,
  },
  role: {
    type: String,
    enum: ['admin', 'user'],
    default: 'user',
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  usage: {
    totalMessages: { type: Number, default: 0 },
    totalConversations: { type: Number, default: 0 },
    lastActiveAt: { type: Date, default: null },
  },
}, {
  timestamps: true,
});

const User: Model<IUser> =
  mongoose.models.User ||
  mongoose.model<IUser>('User', UserSchema);

export default User;
