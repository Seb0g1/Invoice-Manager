import { create } from 'zustand';
import api from '../services/api';

interface CurrencyState {
  rate: number | null;
  currency: 'RUB' | 'USD';
  loading: boolean;
  fetchRate: () => Promise<void>;
  setCurrency: (currency: 'RUB' | 'USD') => void;
  convertToDisplay: (amountRUB: number, amountUSD?: number) => number;
  getCurrencySymbol: () => string;
}

export const useCurrencyStore = create<CurrencyState>((set, get) => ({
  rate: null,
  currency: 'RUB',
  loading: false,
  
  fetchRate: async () => {
    try {
      set({ loading: true });
      const response = await api.get('/currency/rate');
      set({ rate: response.data.rate, loading: false });
    } catch (error) {
      console.error('Error fetching currency rate:', error);
      set({ rate: 90, loading: false }); // Fallback rate
    }
  },
  
  setCurrency: (currency) => {
    set({ currency });
  },
  
  convertToDisplay: (amountRUB: number, amountUSD?: number) => {
    const { currency, rate } = get();
    if (currency === 'USD') {
      if (amountUSD !== undefined) {
        return amountUSD;
      }
      return rate ? amountRUB / rate : 0;
    }
    return amountRUB;
  },
  
  getCurrencySymbol: () => {
    const { currency } = get();
    return currency === 'USD' ? '$' : '₽';
  }
}));

