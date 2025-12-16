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
export const useWarehouseItems = (page: number = 1, itemsPerPage: number = 50, searchTerm?: string, category?: string) => {
  return useQuery<WarehouseItemsResponse, Error>({
    queryKey: ['warehouseItems', page, itemsPerPage, searchTerm, category],
    queryFn: async () => {
      const params: any = {
        page: page.toString(),
        limit: itemsPerPage.toString()
      };
      if (searchTerm) {
        params.search = searchTerm;
      }
      if (category) {
        params.category = category;
      }
      const response = await api.get('/warehouse', { params });
      
      // Логируем ответ API для отладки
      if (response.data.items && response.data.items.length > 0) {
        const testItem = response.data.items.find((item: any) => 
          item.name === 'A.Dunhill Icon Racing Men 100 мл парфюмерная вода' || item.article === '35515'
        );
        if (testItem) {
          console.log('[Frontend API] Товар из API (RAW, ДО обработки):', {
            name: testItem.name,
            quantity: testItem.quantity,
            quantityType: typeof testItem.quantity,
            quantityValue: testItem.quantity,
            quantityString: String(testItem.quantity),
            quantityStringLength: String(testItem.quantity).length,
            article: testItem.article,
            _id: testItem._id,
            fullItem: JSON.stringify(testItem)
          });
        }
      }
      
      // Обработка старого формата (для обратной совместимости)
      if (response.data.items) {
        // Убеждаемся, что quantity - это число, а не строка
        const processedItems = response.data.items.map((item: any) => {
          const isTestItem = item.name === 'A.Dunhill Icon Racing Men 100 мл парфюмерная вода' || item.article === '35515';
          
          if (item.quantity !== undefined && item.quantity !== null) {
            if (isTestItem) {
              console.log('[Frontend API] ДО преобразования в map:', {
                original: item.quantity,
                originalType: typeof item.quantity,
                originalString: String(item.quantity),
                originalStringLength: String(item.quantity).length
              });
            }
            
            const numQuantity = typeof item.quantity === 'string' 
              ? parseFloat(item.quantity) 
              : Number(item.quantity);
            
            if (isTestItem) {
              console.log('[Frontend API] ПОСЛЕ преобразования в map:', {
                numQuantity: numQuantity,
                numQuantityType: typeof numQuantity,
                isNaN: isNaN(numQuantity),
                finalQuantity: isNaN(numQuantity) ? 0 : numQuantity
              });
            }
            
            const finalQuantity = isNaN(numQuantity) ? 0 : numQuantity;
            
            if (isTestItem) {
              console.log('[Frontend API] Возвращаемый объект:', {
                ...item,
                quantity: finalQuantity
              });
            }
            
            return {
              ...item,
              quantity: finalQuantity
            };
          }
          return item;
        });
        
        // Логируем финальный массив для проблемного товара
        const testItemAfter = processedItems.find((item: any) => 
          item.name === 'A.Dunhill Icon Racing Men 100 мл парфюмерная вода' || item.article === '35515'
        );
        if (testItemAfter) {
          console.log('[Frontend API] ФИНАЛЬНЫЙ товар после обработки:', {
            name: testItemAfter.name,
            quantity: testItemAfter.quantity,
            quantityType: typeof testItemAfter.quantity,
            _id: testItemAfter._id,
            article: testItemAfter.article
          });
        }
        
        return {
          ...response.data,
          items: processedItems
        };
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
    placeholderData: (previousData) => previousData, // Сохраняем предыдущие данные при переходе на новую страницу
  });
};

// Создание товара
export const useCreateWarehouseItem = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { name: string; quantity?: number; article?: string; price?: number; category?: string; lowStockThreshold?: number }) => {
      const response = await api.post('/warehouse', data);
      return response.data;
    },
    onSuccess: () => {
      // Инвалидируем кэш, чтобы обновить список
      queryClient.invalidateQueries({ queryKey: ['warehouseItems'] });
      toast.success('Товар добавлен');
    },
    onError: (error: any) => {
      handleError(error, 'Ошибка при добавлении товара');
    },
  });
};

// Обновление товара
export const useUpdateWarehouseItem = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string; quantity?: number; article?: string; price?: number; category?: string; lowStockThreshold?: number } }) => {
      const response = await api.put(`/warehouse/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouseItems'] });
      toast.success('Товар обновлен');
    },
    onError: (error: any) => {
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
    onError: (error: any) => {
      handleError(error, 'Ошибка при удалении товара');
    },
  });
};

// Массовое удаление товаров
export const useDeleteWarehouseItems = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const response = await api.delete('/warehouse', { data: { ids } });
      return response.data;
    },
    onSuccess: (_: any, ids: string[]) => {
      queryClient.invalidateQueries({ queryKey: ['warehouseItems'] });
      toast.success(`Удалено товаров: ${ids.length}`);
    },
    onError: (error: any) => {
      handleError(error, 'Ошибка при удалении товаров');
    },
  });
};

