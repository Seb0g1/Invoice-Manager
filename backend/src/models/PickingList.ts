import mongoose, { Document, Schema } from 'mongoose';

export interface IPickingList extends Document {
  date: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PickingListSchema = new Schema<IPickingList>({
  date: {
    type: Date,
    required: true,
    default: Date.now
  }
}, {
  timestamps: true
});

export default mongoose.model<IPickingList>('PickingList', PickingListSchema);

