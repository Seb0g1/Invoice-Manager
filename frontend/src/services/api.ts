import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { getErrorMessage } from '../utils/errorHandler';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Retry логика для запросов
const retryRequest = async (error: AxiosError, retryCount = 0): Promise<any> => {
  const config = error.config as InternalAxiosRequestConfig & { _retry?: boolean; _retryCount?: number };
  const maxRetries = 3;
  const retryDelay = 1000; // 1 секунда

  // Не повторяем запросы, которые уже были повторены
  if (config._retry) {
    return Promise.reject(error);
  }

  // Повторяем только для определенных ошибок
  const shouldRetry = 
    (!error.response || 
     error.response.status >= 500 || 
     error.response.status === 429 || 
     error.code === 'ECONNABORTED' || 
     error.code === 'ETIMEDOUT' ||
     !error.response) && // Сетевые ошибки
    retryCount < maxRetries;

  if (shouldRetry) {
    config._retry = true;
    config._retryCount = (config._retryCount || 0) + 1;

    // Экспоненциальная задержка: 1s, 2s, 4s
    const delay = retryDelay * Math.pow(2, retryCount);
    
    await new Promise(resolve => setTimeout(resolve, delay));

    // Повторяем запрос
    return api.request(config);
  }

  return Promise.reject(error);
};

// Interceptor для обработки ошибок с retry
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config as InternalAxiosRequestConfig & { _retry?: boolean; _retryCount?: number };
    
    // Пробуем повторить запрос для сетевых ошибок и ошибок сервера
    if (config && !config._retry) {
      try {
        return await retryRequest(error, config._retryCount || 0);
      } catch (retryError) {
        // Если retry не помог, продолжаем с обычной обработкой ошибок
      }
    }

    // Обычная обработка ошибок
    if (error.response?.status === 401) {
      // Перенаправление на страницу входа при 401, но только если:
      // 1. Не на странице входа
      // 2. Не при попытке входа
      // 3. Не при первой проверке авторизации на странице входа
      const isLoginPage = window.location.pathname === '/login';
      const isLoginRequest = error.config?.url?.includes('/auth/login');
      const isCheckAuthRequest = error.config?.url?.includes('/auth/me');
      
      // Не перенаправляем если:
      // - Уже на странице входа
      // - Это запрос на вход
      // - Это проверка авторизации на странице входа (нормальное поведение)
      if (!isLoginPage && !isLoginRequest) {
        // Перенаправление на страницу входа только если это не запрос после входа
        const isCheckAuthAfterLogin = isCheckAuthRequest && 
                                       sessionStorage.getItem('justLoggedIn') === 'true';
        
        if (!isCheckAuthAfterLogin) {
          // Очищаем флаг входа
          sessionStorage.removeItem('justLoggedIn');
          // Перенаправление на страницу входа только если не на странице входа
          if (!isLoginPage) {
            window.location.href = '/login';
          }
        } else {
          // Убираем флаг после первой проверки
          sessionStorage.removeItem('justLoggedIn');
        }
      }
      // Если на странице входа и это проверка авторизации - просто игнорируем 401
      // Это нормально, пользователь просто не авторизован
    } else if (error.response?.status === 403) {
      // Ошибка доступа
      const message = getErrorMessage(error);
      console.error('Доступ запрещён:', message);
      // Не показываем toast для 403, так как это может быть ожидаемое поведение
    } else if (error.response?.status >= 500) {
      // Ошибка сервера
      const message = getErrorMessage(error);
      console.error('Ошибка сервера:', message);
      // Toast будет показан в компонентах при необходимости
    } else if (!error.response) {
      // Нет ответа от сервера (сеть)
      const message = getErrorMessage(error);
      console.error('Ошибка сети:', message);
      // Toast будет показан в компонентах при необходимости
    }
    return Promise.reject(error);
  }
);

export default api;

