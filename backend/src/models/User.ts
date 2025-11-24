import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  login: string;
  password: string;
  role: 'director' | 'collector';
}

const UserSchema = new Schema<IUser>({
  login: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['director', 'collector'],
    required: true
  }
}, {
  timestamps: true
});

export default mongoose.model<IUser>('User', UserSchema);

