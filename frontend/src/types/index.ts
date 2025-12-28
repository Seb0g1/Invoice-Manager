export type UserRole = 'director' | 'collector';

export interface User {
  id: string;
  login: string;
  role: UserRole;
}

export interface Supplier {
  _id: string;
  name: string;
  balance: number;
  balanceUSD?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Invoice {
  _id: string;
  photoUrl?: string;
  date: string;
  supplier: Supplier | string;
  paid: boolean;
  type?: 'income' | 'return'; // Тип накладной: приход или возврат
  amountUSD?: number;
  amountRUB?: number;
  exchangeRate?: number;
  paidAmountRUB?: number; // Оплаченная сумма в рублях (может быть больше суммы накладной)
  paidAmountUSD?: number; // Оплаченная сумма в долларах
  unpaidAmountRUB?: number; // Неоплаченная сумма в рублях (долг)
  unpaidAmountUSD?: number; // Неоплаченная сумма в долларах
  comment?: string; // Комментарий к накладной
  createdAt?: string;
  updatedAt?: string;
}

export interface BalanceHistory {
  _id: string;
  supplier: string;
  date: string;
  change: number;
  changeUSD?: number;
  newBalance: number;
  newBalanceUSD?: number;
  exchangeRate?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface SupplierDetails {
  supplier: Supplier;
  invoices: Invoice[];
  balanceHistory: BalanceHistory[];
  exchangeRate?: number;
}

export interface PickingList {
  _id: string;
  date: string;
  name?: string;
  googleSheetId?: string;
  googleSheetUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PickingListItem {
  _id: string;
  pickingList: string;
  name: string;
  article: string;
  quantity: number;
  price?: number;
  currency?: 'RUB' | 'USD';
  priceRUB?: number;
  priceUSD?: number;
  exchangeRate?: number;
  supplier?: Supplier | string;
  paid: boolean;
  collected: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface PickingListDetails {
  pickingList: PickingList;
  items: PickingListItem[];
}

export interface WarehouseItem {
  _id: string;
  name: string;
  quantity?: number;
  article?: string;
  price?: number;
  category?: string;
  lowStockThreshold?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface OzonConfig {
  clientId: string;
  apiKey: string;
  enabled: boolean;
}

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export interface OzonProduct {
  productId: number;
  offerId: string;
  name: string;
  sku: number;
  price: number;
  oldPrice: number | null;
  currency: string;
  status: string;
  images: string[];
  primaryImage: string | null;
  stock: {
    coming: number;
    present: number;
    reserved: number;
  };
  hasPrice: boolean;
  hasStock: boolean;
  createdAtOzon: string; // Дата создания в Ozon (строка из API)
  updatedAtOzon: string; // Дата обновления в Ozon (строка из API)
}

export interface YandexAccount {
  _id: string;
  name: string;
  apiKey: string;
  businessId?: string;
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Settings {
  theme: 'light' | 'dark' | 'auto';
  autoNightModeEnabled: boolean;
  nightModeStartTime: string;
  nightModeEndTime: string;
  telegramBotToken: string;
  telegramChatId: string;
  telegramTopics: {
    invoiceAdded?: string;
    pickingListItemCollected?: string;
    supplierBalanceChanged?: string;
  };
  telegramEnabled: boolean;
  sidebarEnabled: boolean;
  hiddenPages?: string[];
  rolePermissions?: {
    [role: string]: {
      visiblePages: string[];
      accessibleRoutes: string[];
    };
  };
}

export interface YandexProduct {
  id: number;
  name: string;
  category: string;
  vendor: string;
  pictures: string[];
  primaryImage: string | null;
  barcodes: string[];
  price: number;
  currency: string;
  oldPrice: number | null;
  availability: string;
  count: number;
  sku?: string;
  offerId?: string;
}

