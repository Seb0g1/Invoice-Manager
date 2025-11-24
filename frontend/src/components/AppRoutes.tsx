import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import Suppliers from '../pages/Suppliers';
import SupplierDetail from '../pages/SupplierDetail';
import Invoices from '../pages/Invoices';
import Users from '../pages/Users';
import PickingLists from '../pages/PickingLists';
import Warehouse from '../pages/Warehouse';
import Ozon from '../pages/Ozon';
import OzonPrices from '../pages/OzonPrices';
import OzonChats from '../pages/OzonChats';
import OzonAnalytics from '../pages/OzonAnalytics';
import OzonSearchQueries from '../pages/OzonSearchQueries';
import OzonFinance from '../pages/OzonFinance';
import Yandex from '../pages/Yandex';
import Settings from '../pages/Settings';
import NotFound from '../pages/NotFound';
import PageLoader from './PageLoader';
import api from '../services/api';

// Компонент для проверки доступа к маршруту
const ProtectedRoute: React.FC<{
  path: string;
  element: React.ReactElement;
  fallback?: string;
}> = ({ path, element, fallback = '/invoices' }) => {
  const { user } = useAuthStore();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [_hiddenPages, setHiddenPages] = useState<string[]>([]);
  const [_rolePermissions, setRolePermissions] = useState<{
    [role: string]: {
      visiblePages: string[];
      accessibleRoutes: string[];
    };
  }>({});

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const response = await api.get('/settings');
        const perms = response.data.rolePermissions || {};
        const hidden = response.data.hiddenPages || [];
        setRolePermissions(perms);
        setHiddenPages(hidden);

        // Временно скрываем страницы OZON и Yandex Market для всех
        const temporarilyHiddenPages = [
          '/yandex',
          '/ozon',
          '/ozon/products',
          '/ozon/prices',
          '/ozon/chats',
          '/ozon/analytics',
          '/ozon/search-queries',
          '/ozon/finance'
        ];
        if (temporarilyHiddenPages.includes(path)) {
          setHasAccess(false);
          return;
        }
        
        // Проверяем, не скрыта ли страница глобально
        if (hidden.includes(path)) {
          setHasAccess(false);
          return;
        }

        if (!user?.role) {
          setHasAccess(false);
          return;
        }

        const rolePerms = perms[user.role];
        // Если настройки заданы для этой роли И массив accessibleRoutes не пустой
        // Это означает, что настройки были явно сохранены пользователем
        if (rolePerms && Array.isArray(rolePerms.accessibleRoutes) && rolePerms.accessibleRoutes.length > 0) {
          const hasRouteAccess = rolePerms.accessibleRoutes.includes(path);
          setHasAccess(hasRouteAccess);
          return;
        }

        // Если настройки не заданы, используем старую логику
        // Для страниц, которые по умолчанию только для директора
        const directorOnlyPages = [
          '/users', '/settings', 
          '/ozon', '/ozon/products', '/ozon/prices', '/ozon/chats', 
          '/ozon/analytics', '/ozon/search-queries', '/ozon/finance',
          '/yandex'
        ];
        if (directorOnlyPages.includes(path)) {
          setHasAccess(user.role === 'director');
          return;
        }
        
        // Страница поставщиков доступна и директору, и сборщику
        if (path === '/suppliers') {
          setHasAccess(user.role === 'director' || user.role === 'collector');
          return;
        }

        // Для остальных страниц разрешаем доступ
        setHasAccess(true);
      } catch (error) {
        console.error('Error checking route access:', error);
        // При ошибке разрешаем доступ (старая логика)
        setHasAccess(true);
      }
    };
    checkAccess();
  }, [user, path]);

  if (hasAccess === null) {
    return <PageLoader message="Проверка доступа..." />;
  }

  if (!hasAccess) {
    return <Navigate to={fallback} replace />;
  }

  return element;
};

const AppRoutes: React.FC = () => {
  const { user } = useAuthStore();
  const location = useLocation();
  const [pageLoading, setPageLoading] = useState(false);

  // Показываем loader при переходах между страницами
  useEffect(() => {
    setPageLoading(true);
    const timer = setTimeout(() => {
      setPageLoading(false);
    }, 150); // Небольшая задержка для плавности

    return () => clearTimeout(timer);
  }, [location.pathname]);

  if (pageLoading) {
    return <PageLoader message="Загрузка страницы..." />;
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          <Navigate
            to={user?.role === 'director' ? '/suppliers' : '/invoices'}
            replace
          />
        }
      />
      <Route
        path="/suppliers"
        element={
          <ProtectedRoute
            path="/suppliers"
            element={<Suppliers />}
          />
        }
      />
      <Route
        path="/suppliers/:id"
        element={
          <ProtectedRoute
            path="/suppliers"
            element={<SupplierDetail />}
          />
        }
      />
      <Route path="/invoices" element={<ProtectedRoute path="/invoices" element={<Invoices />} />} />
      <Route path="/picking-lists" element={<ProtectedRoute path="/picking-lists" element={<PickingLists />} />} />
      <Route path="/warehouse" element={<ProtectedRoute path="/warehouse" element={<Warehouse />} />} />
      <Route path="/ozon" element={<ProtectedRoute path="/ozon/products" element={<Ozon />} />} />
      <Route path="/ozon/products" element={<ProtectedRoute path="/ozon/products" element={<Ozon />} />} />
      <Route path="/ozon/prices" element={<ProtectedRoute path="/ozon/prices" element={<OzonPrices />} />} />
      <Route path="/ozon/chats" element={<ProtectedRoute path="/ozon/chats" element={<OzonChats />} />} />
      <Route
        path="/ozon/analytics"
        element={
          <ProtectedRoute
            path="/ozon/analytics"
            element={<OzonAnalytics />}
          />
        }
      />
      <Route
        path="/ozon/search-queries"
        element={
          <ProtectedRoute
            path="/ozon/search-queries"
            element={<OzonSearchQueries />}
          />
        }
      />
      <Route
        path="/ozon/finance"
        element={
          <ProtectedRoute
            path="/ozon/finance"
            element={<OzonFinance />}
          />
        }
      />
      <Route path="/yandex" element={<ProtectedRoute path="/yandex" element={<Yandex />} />} />
      <Route
        path="/settings"
        element={
          <ProtectedRoute
            path="/settings"
            element={<Settings />}
          />
        }
      />
      <Route
        path="/users"
        element={
          <ProtectedRoute
            path="/users"
            element={<Users />}
          />
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default AppRoutes;

