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

