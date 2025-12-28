import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  BottomNavigation,
  BottomNavigationAction,
  Paper
} from '@mui/material';
import {
  Receipt as ReceiptIcon,
  Inventory as InventoryIcon,
  Assignment as AssignmentIcon,
  Warehouse as WarehouseIcon,
  ShoppingCart as ShoppingCartIcon,
  Store as StoreIcon,
  Settings as SettingsIcon,
  TrendingUp as TrendingUpIcon
} from '@mui/icons-material';
import { useAuthStore } from '../store/authStore';
import { useThemeContext } from '../contexts/ThemeContext';
import MobileNavDrawer from './MobileNavDrawer';

const MobileBottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const { mode } = useThemeContext();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerCategory, setDrawerCategory] = useState<'yandex' | 'ozon' | null>(null);

  // Простая функция для проверки видимости страницы по ролям
  const isPageVisible = (roles?: string[]): boolean => {
    if (!user?.role) return false;
    if (!roles) return true;
    return roles.includes(user.role);
  };

  const getCurrentValue = () => {
    if (location.pathname.startsWith('/suppliers')) return '/suppliers';
    if (location.pathname.startsWith('/invoices')) return '/invoices';
    if (location.pathname.startsWith('/statistics')) return '/statistics';
    if (location.pathname.startsWith('/picking-lists')) return '/picking-lists';
    if (location.pathname.startsWith('/warehouse')) return '/warehouse';
    if (location.pathname.startsWith('/yandex') || location.pathname.startsWith('/yandex-market') || location.pathname.startsWith('/price-control')) return 'yandex';
    if (location.pathname.startsWith('/ozon')) return 'ozon';
    if (location.pathname.startsWith('/settings')) {
      if (user?.role === 'collector') return '/settings/profile';
      return '/settings';
    }
    return '/suppliers';
  };

  const handleNavigation = (value: string) => {
    if (value === 'yandex') {
      setDrawerCategory('yandex');
      setDrawerOpen(true);
    } else if (value === 'ozon') {
      setDrawerCategory('ozon');
      setDrawerOpen(true);
    } else {
      navigate(value);
    }
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
        onChange={(_, newValue) => handleNavigation(newValue)}
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
        {isPageVisible(['director', 'collector']) && (
          <BottomNavigationAction
            label="Поставщики"
            icon={<InventoryIcon />}
            value="/suppliers"
          />
        )}
        {isPageVisible(['director', 'collector']) && (
          <BottomNavigationAction
            label="Накладные"
            icon={<ReceiptIcon />}
            value="/invoices"
          />
        )}
        {isPageVisible(['director', 'collector']) && (
          <BottomNavigationAction
            label="Статистика"
            icon={<TrendingUpIcon />}
            value="/statistics"
          />
        )}
        {isPageVisible(['director', 'collector']) && (
          <BottomNavigationAction
            label="Сборка"
            icon={<AssignmentIcon />}
            value="/picking-lists"
          />
        )}
        {isPageVisible(['director', 'collector']) && (
          <BottomNavigationAction
            label="Склад"
            icon={<WarehouseIcon />}
            value="/warehouse"
          />
        )}
        {isPageVisible(['director']) && (
          <BottomNavigationAction
            label="Yandex"
            icon={<StoreIcon />}
            value="yandex"
          />
        )}
        {isPageVisible(['director']) && (
          <BottomNavigationAction
            label="OZON"
            icon={<ShoppingCartIcon />}
            value="ozon"
          />
        )}
        {isPageVisible(['director']) && (
          <BottomNavigationAction
            label="Настройки"
            icon={<SettingsIcon />}
            value="/settings"
          />
        )}
        {isPageVisible(['collector']) && (
          <BottomNavigationAction
            label="Профиль"
            icon={<SettingsIcon />}
            value="/settings/profile"
          />
        )}
      </BottomNavigation>
      
      <MobileNavDrawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setDrawerCategory(null);
        }}
        category={drawerCategory}
      />
    </Paper>
  );
};

export default MobileBottomNav;

