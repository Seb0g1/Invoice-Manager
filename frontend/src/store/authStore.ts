import { create } from 'zustand';
import { User } from '../types';
import api from '../services/api';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (login: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  
  login: async (login: string, password: string) => {
    try {
      const response = await api.post('/auth/login', { login, password });
      // Устанавливаем флаг, что только что залогинились
      sessionStorage.setItem('justLoggedIn', 'true');
      set({ user: response.data.user, loading: false });
    } catch (error: any) {
      set({ loading: false });
      throw error;
    }
  },
  
  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      set({ user: null });
    }
  },
  
  checkAuth: async () => {
    try {
      const response = await api.get('/auth/me');
      set({ user: response.data, loading: false });
    } catch (error: any) {
      // 401 - это нормально, если пользователь не авторизован
      // Не логируем ошибку, просто очищаем состояние
      if (error.response?.status !== 401) {
        console.error('Auth check error:', error);
      }
      set({ user: null, loading: false });
    }
  }
}));

