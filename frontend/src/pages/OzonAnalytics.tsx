import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  useMediaQuery,
  MenuItem,
  Alert,
  FormControl,
  InputLabel,
  Select,
  Chip
} from '@mui/material';
import {
  Search as SearchIcon,
} from '@mui/icons-material';
import api from '../services/api';
import { useThemeContext } from '../contexts/ThemeContext';
import toast from 'react-hot-toast';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ru } from 'date-fns/locale';
import { format } from 'date-fns';

const OzonAnalytics: React.FC = () => {
  const { theme } = useThemeContext();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState<Date | null>(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const [dateTo, setDateTo] = useState<Date | null>(new Date());
  const [metrics, setMetrics] = useState<string[]>(['revenue', 'ordered_units']);
  const [dimension, setDimension] = useState<string[]>(['day']);
  const [analyticsData, setAnalyticsData] = useState<any>(null);

  const availableMetrics = [
    { value: 'revenue', label: 'Заказано на сумму' },
    { value: 'ordered_units', label: 'Заказано товаров' },
    { value: 'hits_view_search', label: 'Показы в поиске и категории' },
    { value: 'hits_view_pdp', label: 'Показы на карточке товара' },
    { value: 'hits_view', label: 'Всего показов' },
    { value: 'hits_tocart_search', label: 'В корзину из поиска/категории' },
    { value: 'hits_tocart_pdp', label: 'В корзину из карточки' },
    { value: 'hits_tocart', label: 'Всего добавлено в корзину' },
    { value: 'session_view_search', label: 'Сессии с показом в поиске' },
    { value: 'session_view_pdp', label: 'Сессии с показом на карточке' },
    { value: 'session_view', label: 'Всего сессий' },
    { value: 'conv_tocart_search', label: 'Конверсия в корзину из поиска' },
    { value: 'conv_tocart_pdp', label: 'Конверсия в корзину из карточки' },
    { value: 'conv_tocart', label: 'Общая конверсия в корзину' },
    { value: 'returns', label: 'Возвращено товаров' },
    { value: 'cancellations', label: 'Отменено товаров' },
    { value: 'delivered_units', label: 'Доставлено товаров' },
    { value: 'position_category', label: 'Позиция в поиске и категории' },
  ];

  const availableDimensions = [
    { value: 'day', label: 'День' },
    { value: 'week', label: 'Неделя' },
    { value: 'month', label: 'Месяц' },
    { value: 'sku', label: 'SKU' },
    { value: 'spu', label: 'SPU' },
    { value: 'year', label: 'Год (Premium)' },
    { value: 'category1', label: 'Категория 1 (Premium)' },
    { value: 'category2', label: 'Категория 2 (Premium)' },
    { value: 'category3', label: 'Категория 3 (Premium)' },
    { value: 'category4', label: 'Категория 4 (Premium)' },
    { value: 'brand', label: 'Бренд (Premium)' },
    { value: 'modelID', label: 'Модель (Premium)' },
  ];

  const handleFetchAnalytics = async () => {
    if (!dateFrom || !dateTo) {
      toast.error('Выберите период');
      return;
    }

    if (metrics.length === 0) {
      toast.error('Выберите хотя бы одну метрику');
      return;
    }

    if (dimension.length === 0) {
      toast.error('Выберите хотя бы одно измерение');
      return;
    }

    try {
      setLoading(true);
      const response = await api.post('/ozon/analytics/data', {
        dateFrom: format(dateFrom, 'yyyy-MM-dd'),
        dateTo: format(dateTo, 'yyyy-MM-dd'),
        metrics,
        dimension,
        filters: [],
        limit: 1000,
        offset: 0,
        sort: [],
      });

      setAnalyticsData(response.data);
      toast.success('Аналитика загружена');
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Ошибка при загрузке аналитики';
      if (error.response?.status === 403 || errorMessage.includes('Premium')) {
        toast.error('Аналитика доступна только для продавцов с подпиской Premium Plus или Premium Pro. Обновите подписку в личном кабинете OZON.');
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ru}>
      <Box sx={{ p: { xs: 1.5, sm: 2, md: 3 } }}>
        <Typography variant="h4" sx={{ fontSize: { xs: '1.5rem', sm: '2rem' }, mb: 3 }}>
          Аналитика OZON
        </Typography>

        <Paper sx={{ p: 3, mb: 3 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <DatePicker
                label="Дата начала"
                value={dateFrom}
                onChange={(newValue) => setDateFrom(newValue)}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    size: isMobile ? "small" : "medium",
                  }
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <DatePicker
                label="Дата окончания"
                value={dateTo}
                onChange={(newValue) => setDateTo(newValue)}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    size: isMobile ? "small" : "medium",
                  }
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size={isMobile ? "small" : "medium"}>
                <InputLabel>Метрики</InputLabel>
                <Select
                  multiple
                  value={metrics}
                  onChange={(e) => setMetrics(e.target.value as string[])}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {(selected as string[]).map((value) => (
                        <Chip key={value} label={availableMetrics.find(m => m.value === value)?.label || value} size="small" />
                      ))}
                    </Box>
                  )}
                >
                  {availableMetrics.map((metric) => (
                    <MenuItem key={metric.value} value={metric.value}>
                      {metric.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size={isMobile ? "small" : "medium"}>
                <InputLabel>Группировка</InputLabel>
                <Select
                  multiple
                  value={dimension}
                  onChange={(e) => setDimension(e.target.value as string[])}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {(selected as string[]).map((value) => (
                        <Chip key={value} label={availableDimensions.find(d => d.value === value)?.label || value} size="small" />
                      ))}
                    </Box>
                  )}
                >
                  {availableDimensions.map((dim) => (
                    <MenuItem key={dim.value} value={dim.value}>
                      {dim.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <Button
                variant="contained"
                onClick={handleFetchAnalytics}
                disabled={loading}
                startIcon={loading ? <CircularProgress size={20} /> : <SearchIcon />}
                size={isMobile ? "large" : "medium"}
                fullWidth={isMobile}
                sx={{ minHeight: { xs: 44, sm: 'auto' } }}
              >
                {loading ? 'Загрузка...' : 'Загрузить аналитику'}
              </Button>
            </Grid>
          </Grid>
        </Paper>

        {analyticsData && (
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Результаты аналитики
            </Typography>
            {analyticsData.timestamp && (
              <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                Время создания отчёта: {analyticsData.timestamp}
              </Typography>
            )}
            {analyticsData.result?.data && analyticsData.result.data.length > 0 ? (
              <TableContainer
                component={Paper}
                sx={{
                  overflowX: 'auto',
                  '& .MuiTable-root': {
                    minWidth: { xs: 400, sm: 600 },
                  }
                }}
              >
                <Table size={isMobile ? "small" : "medium"}>
                  <TableHead>
                    <TableRow>
                      {dimension.map((dim) => (
                        <TableCell key={dim}>
                          {availableDimensions.find(d => d.value === dim)?.label || dim}
                        </TableCell>
                      ))}
                      {metrics.map((metric) => (
                        <TableCell key={metric} align="right">
                          {availableMetrics.find(m => m.value === metric)?.label || metric}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {analyticsData.result.data.map((row: any, index: number) => (
                      <TableRow key={index}>
                        {dimension.map((dim) => (
                          <TableCell key={dim}>
                            {row[dim] || '-'}
                          </TableCell>
                        ))}
                        {metrics.map((metric) => (
                          <TableCell key={metric} align="right">
                            {typeof row[metric] === 'number' 
                              ? row[metric].toLocaleString('ru-RU', { maximumFractionDigits: 2 })
                              : row[metric] || '-'}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Alert severity="info">Нет данных за выбранный период</Alert>
            )}
            {analyticsData.result?.totals && analyticsData.result.totals.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Итого:
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  {metrics.map((metric, index) => (
                    <Chip
                      key={metric}
                      label={`${availableMetrics.find(m => m.value === metric)?.label || metric}: ${analyticsData.result.totals[index]?.toLocaleString('ru-RU', { maximumFractionDigits: 2 }) || '-'}`}
                      color="primary"
                      variant="outlined"
                    />
                  ))}
                </Box>
              </Box>
            )}
          </Paper>
        )}
      </Box>
    </LocalizationProvider>
  );
};

export default OzonAnalytics;

