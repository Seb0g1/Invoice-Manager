import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { Invoice } from '../types';
import { handleError } from '../utils/errorHandler';
import toast from 'react-hot-toast';

interface GetInvoicesParams {
  supplier?: string;
  startDate?: string;
  endDate?: string;
}

interface InvoicesResponse {
  items: Invoice[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Получение накладных
export const useInvoices = (params: GetInvoicesParams = {}) => {
  return useQuery<InvoicesResponse, Error>({
    queryKey: ['invoices', params],
    queryFn: async () => {
      const response = await api.get('/invoices', { params });
      return response.data;
    },
    staleTime: 1 * 60 * 1000, // 1 минута
  });
};

// Удаление накладной
export const useDeleteInvoice = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, confirmDate }: { id: string; confirmDate: string }) => {
      const response = await api.delete(`/invoices/${id}`, { data: { confirmDate } });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['supplier'] });
      toast.success('Накладная удалена');
    },
    onError: (error: any) => {
      handleError(error, 'Ошибка при удалении накладной');
    },
  });
};

// Получение статистики по накладным
export const useInvoiceStatistics = () => {
  return useQuery({
    queryKey: ['invoiceStatistics'],
    queryFn: async () => {
      const response = await api.get('/invoices/statistics');
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 минут (статистика не меняется часто)
  });
};

