import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  BottomNavigation,
  BottomNavigationAction,
  Paper
} from '@mui/material';
import {
  Receipt as ReceiptIcon,
  People as PeopleIcon,
  Inventory as InventoryIcon,
  Assignment as AssignmentIcon,
  Warehouse as WarehouseIcon,
  ShoppingCart as ShoppingCartIcon,
  Store as StoreIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import { useAuthStore } from '../store/authStore';
import { useThemeContext } from '../contexts/ThemeContext';
import api from '../services/api';

const MobileBottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const { mode } = useThemeContext();
  const [hiddenPages, setHiddenPages] = useState<string[]>([]);
  const [rolePermissions, setRolePermissions] = useState<{
    [role: string]: {
      visiblePages: string[];
      accessibleRoutes: string[];
    };
  }>({});

  // Загружаем настройки
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await api.get('/settings');
        setHiddenPages(response.data.hiddenPages || []);
        setRolePermissions(response.data.rolePermissions || {});
      } catch (error) {
        console.error('Error fetching settings:', error);
      }
    };
    fetchSettings();
  }, []);

  // Функция для проверки видимости страницы
  const isPageVisible = (path: string, defaultRoles?: string[]): boolean => {
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
      return false;
    }
    
    // Сначала проверяем, не скрыта ли страница глобально
    if (hiddenPages.includes(path)) {
      return false;
    }
    
    if (!user?.role) return false;
    
    // Проверяем настройки прав доступа для конкретной роли
    const rolePerms = rolePermissions[user.role];
    
    // Если настройки заданы для этой роли И массив visiblePages не пустой
    // Это означает, что настройки были явно сохранены пользователем
    if (rolePerms && Array.isArray(rolePerms.visiblePages) && rolePerms.visiblePages.length > 0) {
      // Используем настройки - проверяем, есть ли путь в списке видимых страниц
      return rolePerms.visiblePages.includes(path);
    }
    
    // Если настройки не заданы или массив пустой, используем старую логику (проверка ролей по умолчанию)
    if (defaultRoles) {
      return defaultRoles.includes(user.role);
    }
    
    return true;
  };

  const getCurrentValue = () => {
    if (location.pathname.startsWith('/invoices')) return '/invoices';
    if (location.pathname.startsWith('/picking-lists')) return '/picking-lists';
    if (location.pathname.startsWith('/warehouse')) return '/warehouse';
    if (location.pathname.startsWith('/ozon')) return '/ozon';
    if (location.pathname.startsWith('/yandex')) return '/yandex';
    if (location.pathname.startsWith('/suppliers')) return '/suppliers';
    if (location.pathname.startsWith('/users')) return '/users';
    if (location.pathname.startsWith('/settings')) return '/settings';
    return '/invoices';
  };

  return (
    <Paper
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        display: { xs: 'block', md: 'none' },
        background: mode === 'dark'
          ? 'rgba(30, 30, 30, 0.9)'
          : 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderTop: mode === 'dark'
          ? '1px solid rgba(255, 255, 255, 0.1)'
          : '1px solid rgba(0, 0, 0, 0.1)',
      }}
      elevation={3}
    >
      <BottomNavigation
        value={getCurrentValue()}
        onChange={(_, newValue) => navigate(newValue)}
        showLabels
        sx={{
          height: { xs: 64, sm: 70 },
          '& .MuiBottomNavigationAction-root': {
            minWidth: { xs: 50, sm: 64 },
            maxWidth: { xs: 80, sm: 120 },
            padding: { xs: '6px 4px', sm: '6px 8px' },
            '&.Mui-selected': {
              paddingTop: { xs: '6px', sm: '6px' },
            },
          },
          '& .MuiBottomNavigationAction-label': {
            fontSize: { xs: '0.65rem', sm: '0.75rem' },
            marginTop: { xs: '2px', sm: '4px' },
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            '&.Mui-selected': {
              fontSize: { xs: '0.65rem', sm: '0.75rem' },
            },
          },
          '& .MuiSvgIcon-root': {
            fontSize: { xs: '1.4rem', sm: '1.5rem' },
          },
        }}
      >
        {isPageVisible('/invoices', ['director', 'collector']) && (
          <BottomNavigationAction
            label="Накладные"
            icon={<ReceiptIcon />}
            value="/invoices"
          />
        )}
        {isPageVisible('/picking-lists', ['director', 'collector']) && (
          <BottomNavigationAction
            label="Сборка"
            icon={<AssignmentIcon />}
            value="/picking-lists"
          />
        )}
        {isPageVisible('/warehouse', ['director', 'collector']) && (
          <BottomNavigationAction
            label="Склад"
            icon={<WarehouseIcon />}
            value="/warehouse"
          />
        )}
        {isPageVisible('/ozon/products', ['director']) && (
          <BottomNavigationAction
            label="OZON"
            icon={<ShoppingCartIcon />}
            value="/ozon"
          />
        )}
        {isPageVisible('/yandex', ['director']) && (
          <BottomNavigationAction
            label="Yandex"
            icon={<StoreIcon />}
            value="/yandex"
          />
        )}
        {isPageVisible('/suppliers', ['director', 'collector']) && (
          <BottomNavigationAction
            label="Поставщики"
            icon={<InventoryIcon />}
            value="/suppliers"
          />
        )}
        {isPageVisible('/users', ['director']) && (
          <BottomNavigationAction
            label="Пользователи"
            icon={<PeopleIcon />}
            value="/users"
          />
        )}
        {isPageVisible('/settings', ['director']) && (
          <BottomNavigationAction
            label="Настройки"
            icon={<SettingsIcon />}
            value="/settings"
          />
        )}
      </BottomNavigation>
    </Paper>
  );
};

export default MobileBottomNav;

