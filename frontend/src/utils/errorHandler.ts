import { AxiosError } from 'axios';
import toast from 'react-hot-toast';

export interface ApiError {
  message: string;
  status?: number;
  code?: string;
  details?: any;
}

/**
 * Извлекает понятное сообщение об ошибке из AxiosError
 */
export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    // AxiosError
    if ('response' in error) {
      const axiosError = error as AxiosError;
      
      // Пытаемся получить сообщение из ответа сервера
      if (axiosError.response?.data) {
        const data = axiosError.response.data as any;
        
        // Если есть message в ответе
        if (data.message) {
          return data.message;
        }
        
        // Если есть errors массив
        if (Array.isArray(data.errors) && data.errors.length > 0) {
          return data.errors[0].message || data.errors[0];
        }
        
        // Если есть error
        if (data.error) {
          return typeof data.error === 'string' ? data.error : data.error.message;
        }
      }
      
      // Стандартные сообщения по статусу
      switch (axiosError.response?.status) {
        case 400:
          return 'Неверный запрос. Проверьте введенные данные.';
        case 401:
          return 'Необходима авторизация';
        case 403:
          return 'Доступ запрещен';
        case 404:
          return 'Ресурс не найден';
        case 409:
          return 'Конфликт данных. Возможно, запись уже существует.';
        case 422:
          return 'Ошибка валидации данных';
        case 429:
          return 'Слишком много запросов. Попробуйте позже.';
        case 500:
          return 'Ошибка сервера. Попробуйте позже.';
        case 502:
          return 'Сервер временно недоступен';
        case 503:
          return 'Сервис временно недоступен';
        default:
          if (axiosError.response?.status) {
            return `Ошибка ${axiosError.response.status}`;
          }
      }
      
      // Сетевые ошибки
      if (axiosError.code === 'ECONNABORTED' || axiosError.code === 'ETIMEDOUT') {
        return 'Превышено время ожидания. Проверьте подключение к интернету.';
      }
      
      if (axiosError.message) {
        return axiosError.message;
      }
    }
    
    // Обычная Error
    return error.message;
  }
  
  // Неизвестная ошибка
  if (typeof error === 'string') {
    return error;
  }
  
  return 'Произошла неизвестная ошибка';
};

/**
 * Обрабатывает ошибку и показывает уведомление пользователю
 */
export const handleError = (error: unknown, defaultMessage?: string): void => {
  const message = defaultMessage || getErrorMessage(error);
  
  // Не показываем toast для 401 ошибок (они обрабатываются в interceptor)
  if (error instanceof Error && 'response' in error) {
    const axiosError = error as AxiosError;
    if (axiosError.response?.status === 401) {
      return; // Обрабатывается в api.ts interceptor
    }
  }
  
  toast.error(message);
};

/**
 * Обрабатывает ошибку и возвращает структурированную информацию
 */
export const parseError = (error: unknown): ApiError => {
  const message = getErrorMessage(error);
  
  if (error instanceof Error && 'response' in error) {
    const axiosError = error as AxiosError;
    return {
      message,
      status: axiosError.response?.status,
      code: axiosError.code,
      details: axiosError.response?.data
    };
  }
  
  return {
    message,
    details: error
  };
};

/**
 * Проверяет, является ли ошибка сетевой
 */
export const isNetworkError = (error: unknown): boolean => {
  if (error instanceof Error && 'response' in error) {
    const axiosError = error as AxiosError;
    return !axiosError.response || 
           axiosError.code === 'ECONNABORTED' || 
           axiosError.code === 'ETIMEDOUT' ||
           axiosError.code === 'ERR_NETWORK';
  }
  return false;
};

/**
 * Проверяет, является ли ошибка ошибкой сервера (5xx)
 */
export const isServerError = (error: unknown): boolean => {
  if (error instanceof Error && 'response' in error) {
    const axiosError = error as AxiosError;
    const status = axiosError.response?.status;
    return status !== undefined && status >= 500 && status < 600;
  }
  return false;
};

/**
 * Проверяет, является ли ошибка ошибкой клиента (4xx)
 */
export const isClientError = (error: unknown): boolean => {
  if (error instanceof Error && 'response' in error) {
    const axiosError = error as AxiosError;
    const status = axiosError.response?.status;
    return status !== undefined && status >= 400 && status < 500;
  }
  return false;
};

