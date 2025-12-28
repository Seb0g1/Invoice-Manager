import mongoose, { Document, Schema } from 'mongoose';

export interface IInvoice extends Document {
  photoUrl?: string;
  date: Date;
  supplier: mongoose.Types.ObjectId;
  createdBy?: mongoose.Types.ObjectId; // Кто создал накладную (сборщик)
  paid: boolean;
  type: 'income' | 'return'; // Тип накладной: приход или возврат
  amountUSD?: number;
  amountRUB?: number;
  exchangeRate?: number; // Курс на момент создания
  paidAmountRUB?: number; // Оплаченная сумма в рублях (может быть больше суммы накладной)
  paidAmountUSD?: number; // Оплаченная сумма в долларах
  unpaidAmountRUB?: number; // Неоплаченная сумма в рублях (долг)
  unpaidAmountUSD?: number; // Неоплаченная сумма в долларах
  comment?: string; // Комментарий к накладной
}

const InvoiceSchema = new Schema<IInvoice>({
  photoUrl: {
    type: String,
    required: false
  },
  date: {
    type: Date,
    required: true,
    default: Date.now,
    index: true // Индекс для сортировки и фильтрации по дате
  },
  supplier: {
    type: Schema.Types.ObjectId,
    ref: 'Supplier',
    required: true,
    index: true // Индекс для быстрого поиска по поставщику
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    index: true // Индекс для статистики по сборщикам
  },
  paid: {
    type: Boolean,
    default: false
  },
  type: {
    type: String,
    enum: ['income', 'return'],
    default: 'income'
  },
  amountUSD: {
    type: Number,
    default: 0
  },
  amountRUB: {
    type: Number,
    default: 0
  },
  exchangeRate: {
    type: Number
  },
  paidAmountRUB: {
    type: Number,
    default: 0
  },
  paidAmountUSD: {
    type: Number,
    default: 0
  },
  unpaidAmountRUB: {
    type: Number,
    default: 0
  },
  unpaidAmountUSD: {
    type: Number,
    default: 0
  },
  comment: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

export default mongoose.model<IInvoice>('Invoice', InvoiceSchema);

