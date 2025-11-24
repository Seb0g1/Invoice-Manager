import mongoose, { Document, Schema } from 'mongoose';

export interface IWarehouseItem extends Document {
  name: string;
  quantity?: number;
  article?: string;
  price?: number;
  createdAt: Date;
  updatedAt: Date;
}

const WarehouseItemSchema = new Schema<IWarehouseItem>({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  quantity: {
    type: Number,
    default: 0,
    min: 0,
  },
  article: {
    type: String,
    trim: true,
  },
  price: {
    type: Number,
    default: 0,
    min: 0,
  },
}, {
  timestamps: true
});

export default mongoose.model<IWarehouseItem>('WarehouseItem', WarehouseItemSchema);

