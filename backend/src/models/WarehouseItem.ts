import mongoose, { Document, Schema } from 'mongoose';

export interface IWarehouseItem extends Document {
  name: string;
  quantity?: number;
  article?: string;
  price?: number;
  category?: string;
  lowStockThreshold?: number; // Порог для уведомления о низких остатках
  createdAt: Date;
  updatedAt: Date;
}

const WarehouseItemSchema = new Schema<IWarehouseItem>({
  name: {
    type: String,
    required: true,
    trim: true,
    index: true, // Индекс для быстрого поиска
  },
  quantity: {
    type: Number,
    default: 0,
    min: 0,
  },
  article: {
    type: String,
    trim: true,
    index: true, // Индекс для быстрого поиска по артикулу
  },
  price: {
    type: Number,
    default: 0,
    min: 0,
  },
  category: {
    type: String,
    trim: true,
    index: true, // Индекс для фильтрации по категориям
  },
  lowStockThreshold: {
    type: Number,
    default: 0,
    min: 0,
  },
}, {
  timestamps: true
});

// Составной индекс для поиска по имени и артикулу
WarehouseItemSchema.index({ name: 'text', article: 'text' });

export default mongoose.model<IWarehouseItem>('WarehouseItem', WarehouseItemSchema);

