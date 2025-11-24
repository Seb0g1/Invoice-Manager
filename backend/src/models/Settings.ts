import mongoose, { Document, Schema } from 'mongoose';

export interface ISettings extends Document {
  theme: 'light' | 'dark' | 'auto';
  autoNightModeEnabled: boolean;
  nightModeStartTime: string; // HH:mm format (MSK)
  nightModeEndTime: string; // HH:mm format (MSK)
  telegramBotToken?: string;
  telegramChatId?: string;
  telegramTopics?: {
    invoiceAdded?: string; // Topic ID
    pickingListItemCollected?: string;
    supplierBalanceChanged?: string;
  };
  telegramEnabled: boolean;
  sidebarEnabled: boolean;
  hiddenPages?: string[]; // Список скрытых страниц (глобально для всех)
  rolePermissions?: {
    [role: string]: {
      visiblePages: string[]; // Пути к страницам, которые видны в меню
      accessibleRoutes: string[]; // Маршруты, к которым есть доступ
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

const SettingsSchema = new Schema<ISettings>({
  theme: {
    type: String,
    enum: ['light', 'dark', 'auto'],
    default: 'auto',
  },
  autoNightModeEnabled: {
    type: Boolean,
    default: false,
  },
  nightModeStartTime: {
    type: String,
    match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, // HH:MM format
    default: '22:00',
  },
  nightModeEndTime: {
    type: String,
    match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, // HH:MM format
    default: '07:00',
  },
  telegramBotToken: {
    type: String,
    trim: true,
  },
  telegramChatId: {
    type: String,
    trim: true,
  },
  telegramTopics: {
    invoiceAdded: {
      type: String,
      trim: true,
    },
    pickingListItemCollected: {
      type: String,
      trim: true,
    },
    supplierBalanceChanged: {
      type: String,
      trim: true,
    },
  },
  telegramEnabled: {
    type: Boolean,
    default: false,
  },
  sidebarEnabled: {
    type: Boolean,
    default: true,
  },
  hiddenPages: {
    type: [String],
    default: [],
  },
  rolePermissions: {
    type: Schema.Types.Mixed,
    default: {},
  },
}, {
  timestamps: true,
});

// Только одна запись настроек
SettingsSchema.index({}, { unique: true });

export default mongoose.model<ISettings>('Settings', SettingsSchema);

