import { QueryClient } from '@tanstack/react-query';

// Настройка QueryClient для кэширования данных
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Время жизни кэша (5 минут)
      staleTime: 5 * 60 * 1000,
      // Время хранения в кэше (10 минут)
      gcTime: 10 * 60 * 1000,
      // Повторные попытки при ошибке
      retry: 1,
      // Рефетч при фокусе окна
      refetchOnWindowFocus: false,
      // Рефетч при переподключении
      refetchOnReconnect: true,
    },
    mutations: {
      // Повторные попытки при ошибке
      retry: 1,
    },
  },
});

