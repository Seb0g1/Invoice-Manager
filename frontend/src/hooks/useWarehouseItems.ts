import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { WarehouseItem } from '../types';
import { handleError } from '../utils/errorHandler';
import toast from 'react-hot-toast';

interface WarehouseItemsResponse {
  items: WarehouseItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Получение товаров со склада
export const useWarehouseItems = (page: number = 1, itemsPerPage: number = 50, searchTerm?: string) => {
  return useQuery<WarehouseItemsResponse, Error>({
    queryKey: ['warehouseItems', page, itemsPerPage, searchTerm],
    queryFn: async () => {
      const params: any = {
        page: page.toString(),
        limit: itemsPerPage.toString()
      };
      if (searchTerm) {
        params.search = searchTerm;
      }
      const response = await api.get('/warehouse', { params });
      
      // Обработка старого формата (для обратной совместимости)
      if (response.data.items) {
        return response.data;
      } else {
        return {
          items: response.data,
          pagination: {
            page: 1,
            limit: response.data.length,
            total: response.data.length,
            totalPages: 1
          }
        };
      }
    },
    keepPreviousData: true, // Сохраняем предыдущие данные при переходе на новую страницу
  });
};

// Создание товара
export const useCreateWarehouseItem = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { name: string; quantity?: number; article?: string; price?: number }) => {
      const response = await api.post('/warehouse', data);
      return response.data;
    },
    onSuccess: () => {
      // Инвалидируем кэш, чтобы обновить список
      queryClient.invalidateQueries({ queryKey: ['warehouseItems'] });
      toast.success('Товар добавлен');
    },
    onError: (error) => {
      handleError(error, 'Ошибка при добавлении товара');
    },
  });
};

// Обновление товара
export const useUpdateWarehouseItem = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string; quantity?: number; article?: string; price?: number } }) => {
      const response = await api.put(`/warehouse/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouseItems'] });
      toast.success('Товар обновлен');
    },
    onError: (error) => {
      handleError(error, 'Ошибка при обновлении товара');
    },
  });
};

// Удаление товара
export const useDeleteWarehouseItem = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/warehouse/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouseItems'] });
      toast.success('Товар удален');
    },
    onError: (error) => {
      handleError(error, 'Ошибка при удалении товара');
    },
  });
};

// Массовое удаление товаров
export const useDeleteWarehouseItems = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const response = await api.delete('/warehouse/bulk', { data: { ids } });
      return response.data;
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ['warehouseItems'] });
      toast.success(`Удалено товаров: ${ids.length}`);
    },
    onError: (error) => {
      handleError(error, 'Ошибка при удалении товаров');
    },
  });
};

