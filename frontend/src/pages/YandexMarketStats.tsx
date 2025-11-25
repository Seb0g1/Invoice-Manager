import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Chip,
  useMediaQuery,
  Alert,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Inventory as InventoryIcon,
  Store as StoreIcon,
  AttachMoney as AttachMoneyIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';
import api from '../services/api';
import { useThemeContext } from '../contexts/ThemeContext';
import toast from 'react-hot-toast';

interface BusinessStat {
  businessId: string;
  businessName: string;
  totalProducts: number;
  productsWithStock: number;
  lastSync?: string;
}

interface Stats {
  overview: {
    totalProducts: number;
    totalBusinesses: number;
    totalLinks: number;
    productsWithStock: number;
    productsWithoutStock: number;
    productsWithPrice: number;
    productsWithoutPrice: number;
  };
  prices: {
    avgPrice: number;
    minPrice: number;
    maxPrice: number;
  };
  stocks: {
    totalAvailable: number;
    totalReserved: number;
  };
  businesses: BusinessStat[];
}

const YandexMarketStats: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const { theme } = useThemeContext();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await api.get('/yandex-market/stats');
      setStats(response.data);
    } catch (error: any) {
      console.error('Ошибка загрузки статистики:', error);
      toast.error('Ошибка загрузки статистики');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!stats) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">Нет данных для отображения</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
          Статистика Яндекс Маркет
        </Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={fetchStats}
          size={isMobile ? 'large' : 'medium'}
        >
          Обновить
        </Button>
      </Box>

      {/* Общая статистика */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <InventoryIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">Всего товаров</Typography>
              </Box>
              <Typography variant="h4" fontWeight="bold">
                {stats.overview.totalProducts}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <StoreIcon sx={{ mr: 1, color: 'success.main' }} />
                <Typography variant="h6">Бизнесов</Typography>
              </Box>
              <Typography variant="h4" fontWeight="bold">
                {stats.overview.totalBusinesses}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <TrendingUpIcon sx={{ mr: 1, color: 'info.main' }} />
                <Typography variant="h6">С остатками</Typography>
              </Box>
              <Typography variant="h4" fontWeight="bold">
                {stats.overview.productsWithStock}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <AttachMoneyIcon sx={{ mr: 1, color: 'warning.main' }} />
                <Typography variant="h6">С ценами</Typography>
              </Box>
              <Typography variant="h4" fontWeight="bold">
                {stats.overview.productsWithPrice}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Статистика по ценам и остаткам */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Статистика по ценам
            </Typography>
            <Box sx={{ mt: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={4}>
                  <Typography variant="body2" color="text.secondary">
                    Средняя
                  </Typography>
                  <Typography variant="h6" fontWeight="bold">
                    {Math.round(stats.prices.avgPrice).toLocaleString('ru-RU')} ₽
                  </Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="body2" color="text.secondary">
                    Минимальная
                  </Typography>
                  <Typography variant="h6" fontWeight="bold">
                    {stats.prices.minPrice.toLocaleString('ru-RU')} ₽
                  </Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="body2" color="text.secondary">
                    Максимальная
                  </Typography>
                  <Typography variant="h6" fontWeight="bold">
                    {stats.prices.maxPrice.toLocaleString('ru-RU')} ₽
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Статистика по остаткам
            </Typography>
            <Box sx={{ mt: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    Доступно
                  </Typography>
                  <Typography variant="h6" fontWeight="bold" color="success.main">
                    {stats.stocks.totalAvailable.toLocaleString('ru-RU')}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    Зарезервировано
                  </Typography>
                  <Typography variant="h6" fontWeight="bold" color="warning.main">
                    {stats.stocks.totalReserved.toLocaleString('ru-RU')}
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Статистика по бизнесам */}
      <Paper>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="h6">Статистика по бизнесам</Typography>
        </Box>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>Бизнес</strong></TableCell>
                <TableCell align="right"><strong>Всего товаров</strong></TableCell>
                <TableCell align="right"><strong>С остатками</strong></TableCell>
                <TableCell><strong>Последняя синхронизация</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {stats.businesses.map((business) => (
                <TableRow key={business.businessId}>
                  <TableCell>
                    <Typography variant="body1" fontWeight="medium">
                      {business.businessName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {business.businessId}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body1" fontWeight="bold">
                      {business.totalProducts}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Chip
                      label={business.productsWithStock}
                      color={business.productsWithStock > 0 ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {business.lastSync
                      ? new Date(business.lastSync).toLocaleString('ru-RU')
                      : 'Никогда'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default YandexMarketStats;

