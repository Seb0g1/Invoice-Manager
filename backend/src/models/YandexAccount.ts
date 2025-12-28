import mongoose, { Document, Schema } from 'mongoose';

export interface IYandexAccount extends Document {
  name: string; // Название аккаунта для удобства
  apiKey: string; // API-ключ от Yandex Market
  businessId?: string; // ID кабинета (опционально, можно получить через API)
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const YandexAccountSchema = new Schema<IYandexAccount>({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  apiKey: {
    type: String,
    required: true,
    trim: true,
  },
  businessId: {
    type: String,
    trim: true,
  },
  enabled: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true
});

export default mongoose.model<IYandexAccount>('YandexAccount', YandexAccountSchema);

