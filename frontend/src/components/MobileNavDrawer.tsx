import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Typography,
  IconButton,
  Box,
} from '@mui/material';
import {
  Close as CloseIcon,
  Store as StoreIcon,
  List as ListIcon,
  Edit as EditIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';
import { useAuthStore } from '../store/authStore';
import { useThemeContext } from '../contexts/ThemeContext';
import api from '../services/api';

interface MobileNavDrawerProps {
  open: boolean;
  onClose: () => void;
  category: 'yandex' | 'ozon' | null;
}

const MobileNavDrawer: React.FC<MobileNavDrawerProps> = ({ open, onClose, category }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const { theme } = useThemeContext();
  const [yandexAccounts, setYandexAccounts] = useState<any[]>([]);

  // Загружаем аккаунты Yandex
  useEffect(() => {
    const fetchYandexAccounts = async () => {
      if (user?.role === 'director') {
        try {
          const response = await api.get('/yandex/accounts');
          setYandexAccounts(response.data || []);
        } catch (error) {
          console.error('Error fetching Yandex accounts:', error);
        }
      }
    };
    if (open && category === 'yandex') {
      fetchYandexAccounts();
    }
  }, [open, category, user]);


  const yandexSubItems = [
    {
      text: 'Общие товары',
      icon: <ListIcon />,
      path: '/yandex',
      roles: ['director']
    },
    {
      text: 'Все товары (Market)',
      icon: <ListIcon />,
      path: '/yandex-market/products',
      roles: ['director']
    },
    {
      text: 'Управление ценами',
      icon: <EditIcon />,
      path: '/price-control',
      roles: ['director']
    },
    {
      text: 'Обновление цен (Go)',
      icon: <EditIcon />,
      path: '/price-update',
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
    }))
  ];

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

  const handleItemClick = (path: string) => {
    navigate(path);
    onClose();
  };

  const isSelected = (path: string) => {
    if (path === '/yandex') {
      return location.pathname === '/yandex' && !location.search.includes('accountId');
    }
    if (path.includes('accountId=')) {
      const accountId = path.split('accountId=')[1];
      return location.search.includes(`accountId=${accountId}`);
    }
    return location.pathname === path;
  };

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          maxHeight: '80vh',
        }
      }}
    >
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" fontWeight="bold">
            {category === 'yandex' ? 'Yandex Market' : category === 'ozon' ? 'OZON' : 'Навигация'}
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
        <Divider sx={{ mb: 1 }} />
        
        <List>
          {category === 'yandex' && yandexSubItems.map((item, index) => (
            <ListItem key={index} disablePadding>
              <ListItemButton
                selected={isSelected(item.path)}
                onClick={() => handleItemClick(item.path)}
                sx={{
                  borderRadius: 1,
                  mb: 0.5,
                  '&.Mui-selected': {
                    backgroundColor: theme.palette.mode === 'dark' 
                      ? 'rgba(255, 255, 255, 0.1)' 
                      : 'rgba(0, 0, 0, 0.08)',
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText 
                  primary={item.text}
                  primaryTypographyProps={{
                    fontSize: '0.95rem',
                  }}
                />
              </ListItemButton>
            </ListItem>
          ))}
          
          {category === 'ozon' && ozonSubItems.map((item, index) => (
            <ListItem key={index} disablePadding>
              <ListItemButton
                selected={isSelected(item.path)}
                onClick={() => handleItemClick(item.path)}
                sx={{
                  borderRadius: 1,
                  mb: 0.5,
                  '&.Mui-selected': {
                    backgroundColor: theme.palette.mode === 'dark' 
                      ? 'rgba(255, 255, 255, 0.1)' 
                      : 'rgba(0, 0, 0, 0.08)',
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText 
                  primary={item.text}
                  primaryTypographyProps={{
                    fontSize: '0.95rem',
                  }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Box>
    </Drawer>
  );
};

export default MobileNavDrawer;

