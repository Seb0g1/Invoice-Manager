import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interceptor для обработки ошибок
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Перенаправление на страницу входа при 401, но только если не на странице входа
      // и не при попытке входа (чтобы избежать циклов)
      const isLoginPage = window.location.pathname === '/login';
      const isLoginRequest = error.config?.url?.includes('/auth/login');
      
      if (!isLoginPage && !isLoginRequest) {
        // Перенаправление на страницу входа
        // Состояние пользователя будет очищено при загрузке страницы входа
        window.location.href = '/login';
      }
    } else if (error.response?.status === 403) {
      // Ошибка доступа
      console.error('Доступ запрещён:', error.response?.data?.message);
    } else if (error.response?.status >= 500) {
      // Ошибка сервера
      console.error('Ошибка сервера:', error.response?.data?.message);
    } else if (!error.response) {
      // Нет ответа от сервера (сеть)
      console.error('Ошибка сети:', error.message);
    }
    return Promise.reject(error);
  }
);

export default api;

