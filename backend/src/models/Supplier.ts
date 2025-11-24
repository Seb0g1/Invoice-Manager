import mongoose, { Document, Schema } from 'mongoose';

export interface ISupplier extends Document {
  name: string;
  balance: number; // Баланс в рублях
  balanceUSD?: number; // Баланс в долларах (вычисляемый)
}

const SupplierSchema = new Schema<ISupplier>({
  name: {
    type: String,
    required: true,
    trim: true
  },
  balance: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

export default mongoose.model<ISupplier>('Supplier', SupplierSchema);

