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
      // Перенаправление на страницу входа при 401
      if (window.location.pathname !== '/login') {
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

