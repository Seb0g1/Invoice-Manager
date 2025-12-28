import mongoose, { Schema, Document } from 'mongoose';

export interface IYandexProductBusinessLink extends Document {
  productId: mongoose.Types.ObjectId; // Ссылка на YandexProduct
  businessId: string; // ID бизнеса в Яндекс Маркете
  offerId: string; // ID оффера в Яндекс Маркете
  sku: string; // SKU товара
  price: number; // Текущая цена
  stock: {
    available: number; // Доступное количество
    reserved?: number; // Зарезервировано
  };
  status?: string; // Статус карточки
  lastSync: Date; // Время последней синхронизации
  createdAt: Date;
  updatedAt: Date;
}

const YandexProductBusinessLinkSchema = new Schema<IYandexProductBusinessLink>({
  productId: { type: Schema.Types.ObjectId, ref: 'YandexProduct', required: true, index: true },
  businessId: { type: String, required: true, index: true },
  offerId: { type: String, required: true, index: true },
  sku: { type: String, index: true },
  price: { type: Number, default: 0 },
  stock: {
    available: { type: Number, default: 0 },
    reserved: { type: Number, default: 0 },
  },
  status: { type: String },
  lastSync: { type: Date, default: Date.now, index: true },
}, {
  timestamps: true,
});

// Составной индекс для быстрого поиска
YandexProductBusinessLinkSchema.index({ productId: 1, businessId: 1 }, { unique: true });
YandexProductBusinessLinkSchema.index({ businessId: 1, offerId: 1 }, { unique: true });

export const YandexProductBusinessLink = mongoose.model<IYandexProductBusinessLink>(
  'YandexProductBusinessLink',
  YandexProductBusinessLinkSchema
);

