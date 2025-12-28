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
  useMediaQuery,
  Chip
} from '@mui/material';
import {
  Receipt as ReceiptIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  TrendingUp as TrendingUpIcon,
  People as PeopleIcon,
  AttachMoney as AttachMoneyIcon
} from '@mui/icons-material';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import { useThemeContext } from '../contexts/ThemeContext';
import { useCurrencyStore } from '../store/currencyStore';
import toast from 'react-hot-toast';

interface Statistics {
  totalInvoices: number;
  paidInvoices: number;
  unpaidInvoices: number;
  incomeInvoices: number;
  returnInvoices: number;
  totalAmountRUB: number;
  totalAmountUSD: number;
  paidAmountRUB: number;
  paidAmountUSD: number;
  unpaidAmountRUB: number;
  unpaidAmountUSD: number;
  collectorsStats: Array<{
    userId: string;
    login: string;
    totalInvoices: number;
    paidInvoices: number;
    unpaidInvoices: number;
    totalAmountRUB: number;
    totalAmountUSD: number;
  }>;
  monthlyStats: Array<{
    month: string;
    count: number;
    amountRUB: number;
    amountUSD: number;
  }>;
}

const Statistics: React.FC = () => {
  const { user } = useAuthStore();
  const { theme } = useThemeContext();
  const { currency } = useCurrencyStore();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Statistics | null>(null);

  useEffect(() => {
    fetchStatistics();
  }, []);

  const fetchStatistics = async () => {
    try {
      setLoading(true);
      const response = await api.get('/invoices/statistics');
      setStats(response.data);
    } catch (error: any) {
      console.error('Ошибка загрузки статистики:', error);
      toast.error(error.response?.data?.message || 'Ошибка при загрузке статистики');
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = (amount: number) => {
    if (currency === 'USD') {
      return `$${amount.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `${amount.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽`;
  };

  const getAmount = (rub: number, usd: number) => {
    return currency === 'USD' ? usd : rub;
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
        <Typography variant="h6" color="error">
          Не удалось загрузить статистику
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2, md: 3 } }}>
      <Typography variant="h4" gutterBottom sx={{ fontSize: { xs: '1.5rem', sm: '2rem' }, mb: 3 }}>
        Статистика
      </Typography>

      {/* Основные метрики */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <ReceiptIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">Всего накладных</Typography>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                {stats.totalInvoices}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <CheckCircleIcon sx={{ mr: 1, color: 'success.main' }} />
                <Typography variant="h6">Оплачено</Typography>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                {stats.paidInvoices}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {stats.totalInvoices > 0 
                  ? `${Math.round((stats.paidInvoices / stats.totalInvoices) * 100)}%`
                  : '0%'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <CancelIcon sx={{ mr: 1, color: 'warning.main' }} />
                <Typography variant="h6">Не оплачено</Typography>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'warning.main' }}>
                {stats.unpaidInvoices}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {stats.totalInvoices > 0 
                  ? `${Math.round((stats.unpaidInvoices / stats.totalInvoices) * 100)}%`
                  : '0%'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <AttachMoneyIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">Общая сумма</Typography>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                {formatAmount(getAmount(stats.totalAmountRUB, stats.totalAmountUSD))}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Неоплачено: {formatAmount(getAmount(stats.unpaidAmountRUB, stats.unpaidAmountUSD))}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Статистика по типам */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                По типам накладных
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 2 }}>
                <Chip
                  icon={<TrendingUpIcon />}
                  label={`Приход: ${stats.incomeInvoices}`}
                  color="primary"
                  variant="outlined"
                />
                <Chip
                  icon={<TrendingUpIcon />}
                  label={`Возврат: ${stats.returnInvoices}`}
                  color="secondary"
                  variant="outlined"
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                По оплате
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 2 }}>
                <Chip
                  icon={<CheckCircleIcon />}
                  label={`Оплачено: ${formatAmount(getAmount(stats.paidAmountRUB, stats.paidAmountUSD))}`}
                  color="success"
                  variant="outlined"
                />
                <Chip
                  icon={<CancelIcon />}
                  label={`Не оплачено: ${formatAmount(getAmount(stats.unpaidAmountRUB, stats.unpaidAmountUSD))}`}
                  color="warning"
                  variant="outlined"
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Статистика по сборщикам (только для директора) */}
      {user?.role === 'director' && stats.collectorsStats.length > 0 && (
        <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <PeopleIcon />
            Статистика по сборщикам
          </Typography>
          <TableContainer>
            <Table size={isMobile ? "small" : "medium"}>
              <TableHead>
                <TableRow>
                  <TableCell>Сборщик</TableCell>
                  <TableCell align="right">Всего накладных</TableCell>
                  <TableCell align="right">Оплачено</TableCell>
                  <TableCell align="right">Не оплачено</TableCell>
                  <TableCell align="right" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                    Сумма ({currency})
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {stats.collectorsStats.map((collector) => (
                  <TableRow key={collector.userId} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {collector.login}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {collector.totalInvoices}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Chip
                        label={collector.paidInvoices}
                        color="success"
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Chip
                        label={collector.unpaidInvoices}
                        color="warning"
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="right" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                      <Typography variant="body2">
                        {formatAmount(getAmount(collector.totalAmountRUB, collector.totalAmountUSD))}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Статистика по месяцам */}
      <Paper sx={{ p: { xs: 2, sm: 3 } }}>
        <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
          Статистика по месяцам (последние 6 месяцев)
        </Typography>
        <TableContainer>
          <Table size={isMobile ? "small" : "medium"}>
            <TableHead>
              <TableRow>
                <TableCell>Месяц</TableCell>
                <TableCell align="right">Количество</TableCell>
                <TableCell align="right" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                  Сумма ({currency})
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {stats.monthlyStats.map((month, index) => (
                <TableRow key={index} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {month.month}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">
                      {month.count}
                    </Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                    <Typography variant="body2">
                      {formatAmount(getAmount(month.amountRUB, month.amountUSD))}
                    </Typography>
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

export default Statistics;

