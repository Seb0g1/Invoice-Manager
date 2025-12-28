import mongoose, { Document, Schema } from 'mongoose';

export interface IOzonConfig extends Document {
  clientId: string;
  apiKey: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const OzonConfigSchema = new Schema<IOzonConfig>({
  clientId: {
    type: String,
    required: true,
    trim: true,
  },
  apiKey: {
    type: String,
    required: true,
    trim: true,
  },
  enabled: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true
});

// Только одна конфигурация OZON
OzonConfigSchema.index({}, { unique: true });

export default mongoose.model<IOzonConfig>('OzonConfig', OzonConfigSchema);

