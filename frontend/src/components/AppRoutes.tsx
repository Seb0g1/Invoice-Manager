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
import Yandex from '../pages/Yandex';
import YandexPriceControl from '../pages/YandexPriceControl';
import YandexPriceUpdate from '../pages/YandexPriceUpdate';
import YandexBusinesses from '../pages/YandexBusinesses';
import YandexMarketProducts from '../pages/YandexMarketProducts';
import YandexMarketStats from '../pages/YandexMarketStats';
import YandexBusinessProducts from '../pages/YandexBusinessProducts';
import Settings from '../pages/Settings';
import Statistics from '../pages/Statistics';
import NotFound from '../pages/NotFound';
import PageLoader from './PageLoader';

// Компонент для проверки доступа к маршруту
const ProtectedRoute: React.FC<{
  element: React.ReactElement;
  allowedRoles?: string[];
  fallback?: string;
}> = ({ element, allowedRoles, fallback = '/suppliers' }) => {
  const { user } = useAuthStore();

  if (!user?.role) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
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
            to={user?.role === 'director' ? '/suppliers' : '/suppliers'}
            replace
          />
        }
      />
      <Route
        path="/suppliers"
        element={
          <ProtectedRoute
            element={<Suppliers />}
            allowedRoles={['director', 'collector']}
          />
        }
      />
      <Route
        path="/suppliers/:id"
        element={
          <ProtectedRoute
            element={<SupplierDetail />}
            allowedRoles={['director', 'collector']}
          />
        }
      />
      <Route 
        path="/invoices" 
        element={
          <ProtectedRoute 
            element={<Invoices />} 
            allowedRoles={['director', 'collector']}
          />} 
      />
      <Route 
        path="/statistics" 
        element={
          <ProtectedRoute 
            element={<Statistics />} 
            allowedRoles={['director', 'collector']}
          />} 
      />
      <Route 
        path="/picking-lists" 
        element={
          <ProtectedRoute 
            element={<PickingLists />} 
            allowedRoles={['director', 'collector']}
          />} 
      />
      <Route 
        path="/warehouse" 
        element={
          <ProtectedRoute 
            element={<Warehouse />} 
            allowedRoles={['director', 'collector']}
          />} 
      />
      <Route 
        path="/ozon" 
        element={
          <Navigate to="/ozon/products" replace />
        } 
      />
      <Route 
        path="/ozon/products" 
        element={
          <ProtectedRoute 
            element={<Ozon />} 
            allowedRoles={['director']}
          />} 
      />
      <Route 
        path="/ozon/prices" 
        element={
          <ProtectedRoute 
            element={<OzonPrices />} 
            allowedRoles={['director']}
          />} 
      />
      <Route 
        path="/yandex" 
        element={
          <ProtectedRoute 
            element={<Yandex />} 
            allowedRoles={['director']}
          />} 
      />
      <Route 
        path="/price-control" 
        element={
          <ProtectedRoute 
            element={<YandexPriceControl />} 
            allowedRoles={['director']}
          />} 
      />
      <Route 
        path="/price-update" 
        element={
          <ProtectedRoute 
            element={<YandexPriceUpdate />} 
            allowedRoles={['director']}
          />} 
      />
      <Route 
        path="/yandex-market/businesses" 
        element={
          <ProtectedRoute 
            element={<YandexBusinesses />} 
            allowedRoles={['director']}
          />} 
      />
      <Route 
        path="/yandex-market/products" 
        element={
          <ProtectedRoute 
            element={<YandexMarketProducts />} 
            allowedRoles={['director']}
          />} 
      />
      <Route 
        path="/yandex-market/stats" 
        element={
          <ProtectedRoute 
            element={<YandexMarketStats />} 
            allowedRoles={['director']}
          />} 
      />
      <Route 
        path="/yandex-market/businesses/:businessId/products" 
        element={
          <ProtectedRoute 
            element={<YandexBusinessProducts />} 
            allowedRoles={['director']}
          />} 
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute
            element={<Settings />}
            allowedRoles={['director']}
          />
        }
      />
      <Route
        path="/settings/profile"
        element={
          <ProtectedRoute
            element={<Settings />}
            allowedRoles={['collector']}
          />
        }
      />
      <Route
        path="/users"
        element={
          <ProtectedRoute
            element={<Users />}
            allowedRoles={['director']}
          />
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default AppRoutes;

