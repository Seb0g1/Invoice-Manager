import mongoose, { Document, Schema } from 'mongoose';

export interface IBalanceHistory extends Document {
  supplier: mongoose.Types.ObjectId;
  date: Date;
  change: number; // Изменение в рублях
  changeUSD?: number; // Изменение в долларах
  newBalance: number; // Новый баланс в рублях
  newBalanceUSD?: number; // Новый баланс в долларах
  exchangeRate?: number; // Курс на момент операции
}

const BalanceHistorySchema = new Schema<IBalanceHistory>({
  supplier: {
    type: Schema.Types.ObjectId,
    ref: 'Supplier',
    required: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  change: {
    type: Number,
    required: true
  },
  newBalance: {
    type: Number,
    required: true
  },
  changeUSD: {
    type: Number
  },
  newBalanceUSD: {
    type: Number
  },
  exchangeRate: {
    type: Number
  }
}, {
  timestamps: true
});

export default mongoose.model<IBalanceHistory>('BalanceHistory', BalanceHistorySchema);

