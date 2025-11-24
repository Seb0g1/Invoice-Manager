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
        // Перенаправление на страницу входа только если это не запрос после входа
        const isCheckAuthAfterLogin = error.config?.url?.includes('/auth/me') && 
                                       sessionStorage.getItem('justLoggedIn') === 'true';
        
        if (!isCheckAuthAfterLogin) {
          // Очищаем флаг входа
          sessionStorage.removeItem('justLoggedIn');
          // Перенаправление на страницу входа
          window.location.href = '/login';
        } else {
          // Убираем флаг после первой проверки
          sessionStorage.removeItem('justLoggedIn');
        }
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

