import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Divider,
  Typography,
  Collapse
} from '@mui/material';
import {
  Receipt as ReceiptIcon,
  Inventory as InventoryIcon,
  Assignment as AssignmentIcon,
  Warehouse as WarehouseIcon,
  ShoppingCart as ShoppingCartIcon,
  Store as StoreIcon,
  Settings as SettingsIcon,
  ExpandLess,
  ExpandMore,
  List as ListIcon,
  Edit as EditIcon,
  TrendingUp as TrendingUpIcon
} from '@mui/icons-material';
import { useAuthStore } from '../store/authStore';
import { useThemeContext } from '../contexts/ThemeContext';
import api from '../services/api';

const drawerWidth = 240;

const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const { theme } = useThemeContext();
  const [yandexOpen, setYandexOpen] = useState(false);
  const [ozonOpen, setOzonOpen] = useState(false);
  const [yandexAccounts, setYandexAccounts] = useState<any[]>([]);
  const [yandexBusinesses, setYandexBusinesses] = useState<any[]>([]);

  // Загружаем аккаунты Yandex и бизнесы для подменю
  useEffect(() => {
    const fetchYandexData = async () => {
      if (user?.role === 'director') {
        try {
          const [accountsResponse, businessesResponse] = await Promise.all([
            api.get('/yandex/accounts').catch(() => ({ data: [] })),
            api.get('/yandex-market/businesses').catch(() => ({ data: { businesses: [] } })),
          ]);
          setYandexAccounts(Array.isArray(accountsResponse.data) ? accountsResponse.data : []);
          // Обрабатываем разные форматы ответа для бизнесов
          const businessesData = businessesResponse.data;
          if (Array.isArray(businessesData)) {
            setYandexBusinesses(businessesData);
          } else if (businessesData?.businesses && Array.isArray(businessesData.businesses)) {
            setYandexBusinesses(businessesData.businesses);
          } else {
            setYandexBusinesses([]);
          }
        } catch (error) {
          console.error('Error fetching Yandex data:', error);
        }
      }
    };
    fetchYandexData();
  }, [user]);

  // Проверяем, открыта ли категория Yandex или OZON
  useEffect(() => {
    const isYandexPath = location.pathname.startsWith('/yandex');
    const isOzonPath = location.pathname.startsWith('/ozon');
    setYandexOpen(isYandexPath);
    setOzonOpen(isOzonPath);
  }, [location.pathname]);

  // Простая функция для проверки видимости страницы по ролям
  const isPageVisible = (roles?: string[]): boolean => {
    if (!user?.role) return false;
    if (!roles) return true;
    return roles.includes(user.role);
  };

  // Базовые пункты меню
  const baseMenuItems: Array<{
    text: string;
    icon: React.ReactElement;
    path: string;
    roles: string[];
    hasSubmenu?: boolean;
  }> = [
    {
      text: 'Поставщики',
      icon: <InventoryIcon />,
      path: '/suppliers',
      roles: ['director', 'collector']
    },
    {
      text: 'Накладные',
      icon: <ReceiptIcon />,
      path: '/invoices',
      roles: ['director', 'collector']
    },
    {
      text: 'Статистика',
      icon: <TrendingUpIcon />,
      path: '/statistics',
      roles: ['director', 'collector']
    },
    {
      text: 'Лист сборки',
      icon: <AssignmentIcon />,
      path: '/picking-lists',
      roles: ['director', 'collector']
    },
    {
      text: 'Наш склад',
      icon: <WarehouseIcon />,
      path: '/warehouse',
      roles: ['director', 'collector']
    },
  ];

  // Пункты меню только для директора
  const directorMenuItems: Array<{
    text: string;
    icon: React.ReactElement;
    path: string;
    roles: string[];
    hasSubmenu?: boolean;
  }> = [
    {
      text: 'Yandex Market',
      icon: <StoreIcon />,
      path: '/yandex',
      roles: ['director'],
      hasSubmenu: true
    },
    {
      text: 'OZON',
      icon: <ShoppingCartIcon />,
      path: '/ozon',
      roles: ['director'],
      hasSubmenu: true
    },
    {
      text: 'Настройки',
      icon: <SettingsIcon />,
      path: '/settings',
      roles: ['director']
    }
  ];

  // Пункты меню для сборщика
  const collectorMenuItems: Array<{
    text: string;
    icon: React.ReactElement;
    path: string;
    roles: string[];
    hasSubmenu?: boolean;
  }> = [
    {
      text: 'Настройки профиля',
      icon: <SettingsIcon />,
      path: '/settings/profile',
      roles: ['collector']
    }
  ];

  // Фильтруем пункты меню по ролям
  const menuItems = baseMenuItems.filter((item) => isPageVisible(item.roles));
  
  if (user?.role === 'director') {
    menuItems.push(...directorMenuItems.filter((item) => isPageVisible(item.roles)));
  } else if (user?.role === 'collector') {
    menuItems.push(...collectorMenuItems.filter((item) => isPageVisible(item.roles)));
  }

  // Подменю Yandex
  const yandexSubItems = [
    {
      text: 'Все товары',
      icon: <ListIcon />,
      path: '/yandex-market/products',
      roles: ['director']
    },
    {
      text: 'Бизнесы',
      icon: <StoreIcon />,
      path: '/yandex-market/businesses',
      roles: ['director']
    },
    {
      text: 'Статистика',
      icon: <TrendingUpIcon />,
      path: '/yandex-market/stats',
      roles: ['director']
    },
    ...yandexAccounts.map((account, index) => ({
      text: account.name || `Аккаунт ${index + 1}`,
      icon: <StoreIcon />,
      path: `/yandex?accountId=${account._id}`,
      roles: ['director'] as string[]
    })),
    ...yandexBusinesses.filter(b => b.enabled).map((business) => ({
      text: business.name || `Бизнес ${business.businessId}`,
      icon: <StoreIcon />,
      path: `/yandex-market/businesses/${business.businessId}/products`,
      roles: ['director'] as string[]
    }))
  ];

  // Подменю OZON
  const ozonSubItems = [
    {
      text: 'Общий список товаров',
      icon: <ListIcon />,
      path: '/ozon/products',
      roles: ['director']
    },
    {
      text: 'Изменить цену',
      icon: <EditIcon />,
      path: '/ozon/prices',
      roles: ['director']
    }
  ];

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        display: { xs: 'none', md: 'block' },
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          borderRight: 'none',
          boxShadow: theme.palette.mode === 'dark' 
            ? '2px 0 8px rgba(0, 0, 0, 0.3)' 
            : '2px 0 8px rgba(0, 0, 0, 0.1)',
        }
      }}
    >
      <Toolbar sx={{ px: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <img 
          src="/Logo.svg" 
          alt="David Manager Logo" 
          style={{ 
            height: '36px',
            width: 'auto',
          }}
        />
        <Typography
          variant="h6"
          noWrap
          component="div"
          sx={{
            fontWeight: 700,
            color: theme.palette.text.primary,
            fontSize: '1.25rem',
            flexGrow: 1,
          }}
        >
          David Manager
        </Typography>
      </Toolbar>
      <Divider />
      <List>
        {menuItems.map((item) => {
          // Если это Yandex или OZON с подменю
          if (item.hasSubmenu) {
            const isYandex = item.path === '/yandex';
            const subItems = isYandex ? yandexSubItems : ozonSubItems;
            const isOpen = isYandex ? yandexOpen : ozonOpen;
            const setIsOpen = isYandex ? setYandexOpen : setOzonOpen;

            return (
              <React.Fragment key={item.text}>
                <ListItem disablePadding>
                  <ListItemButton
                    onClick={() => setIsOpen(!isOpen)}
                    selected={location.pathname.startsWith(item.path)}
                  >
                    <ListItemIcon>{item.icon}</ListItemIcon>
                    <ListItemText primary={item.text} />
                    {isOpen ? <ExpandLess /> : <ExpandMore />}
                  </ListItemButton>
                </ListItem>
                <Collapse in={isOpen} timeout="auto" unmountOnExit>
                  <List component="div" disablePadding>
                    {subItems.map((subItem) => {
                      // Для Yandex проверяем query параметр accountId
                      let isSelected = false;
                      if (isYandex) {
                        if (subItem.path === '/yandex') {
                          // Общие товары - когда нет accountId в query
                          isSelected = !location.search.includes('accountId');
                        } else {
                          // Конкретный аккаунт - проверяем accountId в query
                          const accountId = subItem.path.split('accountId=')[1];
                          isSelected = location.search.includes(`accountId=${accountId}`);
                        }
                      } else {
                        // Для OZON просто проверяем путь
                        isSelected = location.pathname === subItem.path;
                      }
                      
                      return (
                        <ListItem key={subItem.text} disablePadding>
                          <ListItemButton
                            selected={isSelected}
                            onClick={() => navigate(subItem.path)}
                            sx={{ pl: 4 }}
                          >
                            <ListItemIcon>{subItem.icon}</ListItemIcon>
                            <ListItemText primary={subItem.text} />
                          </ListItemButton>
                        </ListItem>
                      );
                    })}
                  </List>
                </Collapse>
              </React.Fragment>
            );
          }

          // Обычный пункт меню
          return (
            <ListItem key={item.text} disablePadding>
              <ListItemButton
                selected={location.pathname === item.path}
                onClick={() => navigate(item.path)}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.text} />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </Drawer>
  );
};

export default Sidebar;

