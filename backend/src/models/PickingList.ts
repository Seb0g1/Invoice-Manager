import mongoose, { Document, Schema } from 'mongoose';

export interface IPickingList extends Document {
  date: Date;
  name?: string; // Название листа сборки (для Google таблицы)
  googleSheetId?: string; // ID Google таблицы
  googleSheetUrl?: string; // URL Google таблицы
  createdAt: Date;
  updatedAt: Date;
}

const PickingListSchema = new Schema<IPickingList>({
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  name: {
    type: String,
    trim: true
  },
  googleSheetId: {
    type: String,
    trim: true
  },
  googleSheetUrl: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

export default mongoose.model<IPickingList>('PickingList', PickingListSchema);

