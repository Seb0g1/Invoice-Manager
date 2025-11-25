import mongoose, { Schema, Document } from 'mongoose';

export interface IYandexProduct extends Document {
  vendorCode: string; // Артикул - ключевой идентификатор для объединения товаров
  name: string;
  description?: string;
  images: string[];
  category?: string;
  mainProductId?: mongoose.Types.ObjectId; // Если товар объединен с другим
  createdAt: Date;
  updatedAt: Date;
}

const YandexProductSchema = new Schema<IYandexProduct>({
  vendorCode: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, index: true },
  description: { type: String },
  images: { type: [String], default: [] },
  category: { type: String },
  mainProductId: { type: Schema.Types.ObjectId, ref: 'YandexProduct', index: true },
}, {
  timestamps: true,
});

// Индекс для текстового поиска
YandexProductSchema.index({ name: 'text', vendorCode: 'text' });

export const YandexProduct = mongoose.model<IYandexProduct>('YandexProduct', YandexProductSchema);

