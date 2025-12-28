import mongoose, { Document, Schema } from 'mongoose';

export interface IPickingListItem extends Document {
  pickingList: mongoose.Types.ObjectId;
  name: string; // Наименование
  article: string; // Артикул
  quantity: number; // Количество
  price?: number; // Цена (в валюте currency)
  currency?: 'RUB' | 'USD'; // Валюта
  priceRUB?: number; // Цена в рублях
  priceUSD?: number; // Цена в долларах
  exchangeRate?: number; // Курс обмена на момент создания
  supplier?: mongoose.Types.ObjectId; // Поставщик
  paid: boolean; // Оплачено
  collected: boolean; // Собрано
  createdAt: Date;
  updatedAt: Date;
}

const PickingListItemSchema = new Schema<IPickingListItem>({
  pickingList: {
    type: Schema.Types.ObjectId,
    ref: 'PickingList',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  article: {
    type: String,
    trim: true,
    default: ''
  },
  quantity: {
    type: Number,
    required: true,
    default: 1,
    min: 0
  },
  price: {
    type: Number,
    default: 0,
    min: 0
  },
  currency: {
    type: String,
    enum: ['RUB', 'USD'],
    default: 'RUB'
  },
  priceRUB: {
    type: Number,
    default: 0,
    min: 0
  },
  priceUSD: {
    type: Number,
    default: 0,
    min: 0
  },
  exchangeRate: {
    type: Number,
    default: 0
  },
  supplier: {
    type: Schema.Types.ObjectId,
    ref: 'Supplier'
  },
  paid: {
    type: Boolean,
    default: false
  },
  collected: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

export default mongoose.model<IPickingListItem>('PickingListItem', PickingListItemSchema);

