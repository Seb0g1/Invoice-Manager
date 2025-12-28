import mongoose, { Schema, Document } from 'mongoose';

export interface IYandexBusiness extends Document {
  businessId: string;
  name: string;
  enabled: boolean;
  accessToken?: string; // Api-Key для Market Yandex Go (используется как accessToken)
  refreshToken?: string;
  tokenExpiresAt?: Date;
  lastSyncAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const YandexBusinessSchema = new Schema<IYandexBusiness>({
  businessId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  enabled: { type: Boolean, default: true },
  accessToken: { type: String }, // Api-Key для Market Yandex Go
  refreshToken: { type: String },
  tokenExpiresAt: { type: Date },
  lastSyncAt: { type: Date },
}, {
  timestamps: true,
});

export const YandexBusiness = mongoose.model<IYandexBusiness>('YandexBusiness', YandexBusinessSchema);

