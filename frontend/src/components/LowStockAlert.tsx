import React, { useState, useEffect } from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Collapse,
  IconButton,
  Chip
} from '@mui/material';
import {
  Warning as WarningIcon,
  Close as CloseIcon,
  Inventory as InventoryIcon
} from '@mui/icons-material';
import api from '../services/api';
import { WarehouseItem } from '../types';
import { useNavigate } from 'react-router-dom';

const LowStockAlert: React.FC = () => {
  const [lowStockItems, setLowStockItems] = useState<WarehouseItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchLowStockItems = async () => {
      try {
        setLoading(true);
        const response = await api.get('/warehouse/low-stock');
        setLowStockItems(response.data.items || []);
      } catch (error) {
        console.error('Ошибка загрузки товаров с низкими остатками:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLowStockItems();
    // Обновляем каждые 5 минут
    const interval = setInterval(fetchLowStockItems, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading || lowStockItems.length === 0) {
    return null;
  }

  return (
    <Collapse in={open}>
      <Alert
        severity="warning"
        icon={<WarningIcon />}
        action={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              color="inherit"
              size="small"
              onClick={() => navigate('/warehouse')}
              startIcon={<InventoryIcon />}
            >
              Перейти к складу
            </Button>
            <IconButton
              aria-label="close"
              color="inherit"
              size="small"
              onClick={() => setOpen(false)}
            >
              <CloseIcon fontSize="inherit" />
            </IconButton>
          </Box>
        }
        sx={{ mb: 2 }}
      >
        <AlertTitle>
          Внимание! Товары с низкими остатками ({lowStockItems.length})
        </AlertTitle>
        <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {lowStockItems.slice(0, 10).map((item) => (
            <Chip
              key={item._id}
              label={`${item.name}: ${item.quantity ?? 0}`}
              size="small"
              color="warning"
              variant="outlined"
            />
          ))}
          {lowStockItems.length > 10 && (
            <Chip
              label={`+${lowStockItems.length - 10} еще...`}
              size="small"
              color="warning"
              variant="outlined"
            />
          )}
        </Box>
      </Alert>
    </Collapse>
  );
};

export default LowStockAlert;

