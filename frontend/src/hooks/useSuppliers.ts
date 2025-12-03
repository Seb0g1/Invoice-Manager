import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { Supplier } from '../types';
import { handleError } from '../utils/errorHandler';
import toast from 'react-hot-toast';

// Получение списка поставщиков
export const useSuppliers = () => {
  return useQuery<Supplier[], Error>({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const response = await api.get('/suppliers');
      return response.data;
    },
    staleTime: 2 * 60 * 1000, // 2 минуты
  });
};

// Получение деталей поставщика
export const useSupplierDetails = (supplierId: string | null) => {
  return useQuery({
    queryKey: ['supplier', supplierId],
    queryFn: async () => {
      if (!supplierId) return null;
      const response = await api.get(`/suppliers/${supplierId}`);
      return response.data;
    },
    enabled: !!supplierId, // Запрос выполняется только если supplierId существует
    staleTime: 1 * 60 * 1000, // 1 минута
  });
};

// Создание поставщика
export const useCreateSupplier = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (name: string) => {
      const response = await api.post('/suppliers', { name });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('Поставщик создан');
    },
    onError: (error: any) => {
      handleError(error, 'Ошибка при создании поставщика');
    },
  });
};

