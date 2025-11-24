import mongoose, { Schema, Document } from 'mongoose';

export interface IOzonProduct extends Document {
  productId: number;
  offerId: string;
  sku: number;
  name: string;
  price: number;
  oldPrice: number | null;
  currency: string;
  status: string;
  images: string[];
  primaryImage: string | null;
  stock: {
    coming: number;
    present: number;
    reserved: number;
  };
  hasPrice: boolean;
  hasStock: boolean;
  createdAtOzon: string; // Дата создания в Ozon (строка из API)
  updatedAtOzon: string; // Дата обновления в Ozon (строка из API)
  syncedAt: Date; // Когда последний раз синхронизировали
}

const OzonProductSchema = new Schema<IOzonProduct>({
  productId: { type: Number, required: true, unique: true, index: true },
  offerId: { type: String, required: true, index: true },
  sku: { type: Number, required: true, index: true },
  name: { type: String, required: true, index: true },
  price: { type: Number, default: 0 },
  oldPrice: { type: Number, default: null },
  currency: { type: String, default: 'RUB' },
  status: { type: String, default: '' },
  images: { type: [String], default: [] },
  primaryImage: { type: String, default: null },
  stock: {
    coming: { type: Number, default: 0 },
    present: { type: Number, default: 0, index: true },
    reserved: { type: Number, default: 0 },
  },
  hasPrice: { type: Boolean, default: false },
  hasStock: { type: Boolean, default: false, index: true },
  createdAtOzon: { type: String, default: '' },
  updatedAtOzon: { type: String, default: '' },
  syncedAt: { type: Date, default: Date.now, index: true },
}, {
  timestamps: true, // Mongoose автоматически создаст createdAt и updatedAt как Date
});

// Составные индексы для быстрого поиска
OzonProductSchema.index({ name: 'text', offerId: 'text' }); // Текстовый поиск
OzonProductSchema.index({ price: 1, 'stock.present': 1 }); // Для фильтрации по цене и остаткам
OzonProductSchema.index({ status: 1, hasStock: 1 }); // Для фильтрации по статусу и наличию

export const OzonProduct = mongoose.model<IOzonProduct>('OzonProduct', OzonProductSchema);

