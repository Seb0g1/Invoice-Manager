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
  People as PeopleIcon,
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
  Chat as ChatIcon,
  Analytics as AnalyticsIcon,
  Search as SearchIcon,
  AccountBalance as AccountBalanceIcon
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
  const [ozonOpen, setOzonOpen] = useState(false);
  const [sidebarEnabled, setSidebarEnabled] = useState(true);
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
        setSidebarEnabled(response.data.sidebarEnabled !== undefined ? response.data.sidebarEnabled : true);
        setHiddenPages(response.data.hiddenPages || []);
        setRolePermissions(response.data.rolePermissions || {});
      } catch (error) {
        // Если ошибка, используем значения по умолчанию
        console.error('Error fetching settings:', error);
      }
    };
    fetchSettings();
  }, []);

  // Проверяем, открыта ли категория OZON
  useEffect(() => {
    const isOzonPath = location.pathname.startsWith('/ozon');
    setOzonOpen(isOzonPath);
  }, [location.pathname]);

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

  const allMenuItems = [
    {
      text: 'Накладные',
      icon: <ReceiptIcon />,
      path: '/invoices',
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
    {
      text: 'Yandex Market',
      icon: <StoreIcon />,
      path: '/yandex',
      roles: ['director']
    },
    {
      text: 'Поставщики',
      icon: <InventoryIcon />,
      path: '/suppliers',
      roles: ['director', 'collector']
    },
    {
      text: 'Пользователи',
      icon: <PeopleIcon />,
      path: '/users',
      roles: ['director']
    },
    {
      text: 'Настройки',
      icon: <SettingsIcon />,
      path: '/settings',
      roles: ['director']
    }
  ];

  // Фильтруем пункты меню на основе настроек
  const menuItems = allMenuItems.filter((item) => {
    if (!user?.role) return false;
    // Проверяем видимость через настройки, передавая роли по умолчанию
    return isPageVisible(item.path, item.roles);
  });

  const allOzonSubItems = [
    {
      text: 'Список товаров',
      icon: <ListIcon />,
      path: '/ozon/products',
      roles: ['director']
    },
    {
      text: 'Обновить цены',
      icon: <EditIcon />,
      path: '/ozon/prices',
      roles: ['director']
    },
    {
      text: 'Чаты с покупателями',
      icon: <ChatIcon />,
      path: '/ozon/chats',
      roles: ['director']
    },
    {
      text: 'Аналитика',
      icon: <AnalyticsIcon />,
      path: '/ozon/analytics',
      roles: ['director']
    },
    {
      text: 'Поисковые запросы',
      icon: <SearchIcon />,
      path: '/ozon/search-queries',
      roles: ['director']
    },
    {
      text: 'Финансы',
      icon: <AccountBalanceIcon />,
      path: '/ozon/finance',
      roles: ['director']
    }
  ];

  // Фильтруем подпункты OZON на основе настроек
  const ozonSubItems = allOzonSubItems.filter((item) => {
    if (!user?.role) return false;
    // Проверяем видимость через настройки, передавая роли по умолчанию
    return isPageVisible(item.path, item.roles);
  });

  // Если sidebar отключен, не рендерим его
  if (!sidebarEnabled) {
    return null;
  }

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
        }
      }}
    >
      <Toolbar sx={{ px: 2 }}>
        <Typography
          variant="h6"
          noWrap
          component="div"
          sx={{
            fontWeight: 700,
            color: theme.palette.text.primary,
            fontSize: '1.25rem',
            width: '100%',
            textAlign: 'left',
          }}
        >
          David Manager
        </Typography>
      </Toolbar>
      <Divider />
      <List>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => navigate(item.path)}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
        
        {/* Категория OZON с подкатегориями - показываем только если есть доступ хотя бы к одной странице */}
        {ozonSubItems.length > 0 && (
          <>
            <ListItem disablePadding>
              <ListItemButton
                onClick={() => setOzonOpen(!ozonOpen)}
                selected={location.pathname.startsWith('/ozon')}
              >
                <ListItemIcon>
                  <ShoppingCartIcon />
                </ListItemIcon>
                <ListItemText primary="OZON" />
                {ozonOpen ? <ExpandLess /> : <ExpandMore />}
              </ListItemButton>
            </ListItem>
            <Collapse in={ozonOpen} timeout="auto" unmountOnExit>
              <List component="div" disablePadding>
                {ozonSubItems.map((item) => (
                  <ListItem key={item.text} disablePadding>
                    <ListItemButton
                      selected={location.pathname === item.path}
                      onClick={() => navigate(item.path)}
                      sx={{ pl: 4 }}
                    >
                      <ListItemIcon>{item.icon}</ListItemIcon>
                      <ListItemText primary={item.text} />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </Collapse>
          </>
        )}
      </List>
    </Drawer>
  );
};

export default Sidebar;

