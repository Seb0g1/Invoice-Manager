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
  Alert
} from '@mui/material';
import {
  GetApp as GetAppIcon
} from '@mui/icons-material';
import api from '../services/api';
import { useThemeContext } from '../contexts/ThemeContext';
import toast from 'react-hot-toast';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ru } from 'date-fns/locale';
import { format } from 'date-fns';

const OzonFinance: React.FC = () => {
  const { theme } = useThemeContext();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [loading, setLoading] = useState(false);
  const [realizationData, setRealizationData] = useState<any>(null);

  const handleFetchRealization = async () => {
    if (!selectedDate) {
      toast.error('Выберите дату');
      return;
    }

    try {
      setLoading(true);
      const day = selectedDate.getDate();
      const month = selectedDate.getMonth() + 1;
      const year = selectedDate.getFullYear();

      const response = await api.post('/ozon/finance/realization', {
        day,
        month,
        year,
      });

      setRealizationData(response.data);
      toast.success('Отчёт о реализации загружен');
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Ошибка при загрузке отчёта о реализации';
      if (error.response?.status === 403 || errorMessage.includes('Premium')) {
        toast.error('Этот метод доступен только для продавцов с подпиской Premium Plus или Premium Pro. Обновите подписку в личном кабинете OZON.');
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
          Финансы OZON
        </Typography>

        <Paper sx={{ p: 3, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={4}>
              <DatePicker
                label="Дата отчёта"
                value={selectedDate}
                onChange={(newValue) => setSelectedDate(newValue)}
                maxDate={new Date()}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    size: isMobile ? "small" : "medium",
                  }
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={8}>
              <Button
                variant="contained"
                onClick={handleFetchRealization}
                disabled={loading}
                startIcon={loading ? <CircularProgress size={20} /> : <GetAppIcon />}
                size={isMobile ? "large" : "medium"}
                fullWidth={isMobile}
                sx={{ minHeight: { xs: 44, sm: 'auto' } }}
              >
                {loading ? 'Загрузка...' : 'Загрузить отчёт о реализации'}
              </Button>
            </Grid>
          </Grid>
          <Alert severity="info" sx={{ mt: 2 }}>
            Данные доступны не более чем за 32 календарных дня от текущей даты. Доступно для продавцов с подпиской Premium Plus или Premium Pro.
          </Alert>
        </Paper>

        {realizationData && (
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Отчёт о реализации за {selectedDate && format(selectedDate, 'dd.MM.yyyy')}
            </Typography>
            {realizationData.rows && realizationData.rows.length > 0 ? (
              <TableContainer
                component={Paper}
                sx={{
                  overflowX: 'auto',
                  '& .MuiTable-root': {
                    minWidth: { xs: 500, sm: 700 },
                  }
                }}
              >
                <Table size={isMobile ? "small" : "medium"}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Товар</TableCell>
                      <TableCell>SKU</TableCell>
                      <TableCell>Артикул</TableCell>
                      <TableCell align="right">Цена продавца</TableCell>
                      <TableCell align="right">Комиссия за доставку</TableCell>
                      <TableCell align="right">Комиссия за возврат</TableCell>
                      <TableCell align="right">Доля комиссии</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {realizationData.rows.map((row: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell>{row.item?.name || '-'}</TableCell>
                        <TableCell>{row.item?.sku || '-'}</TableCell>
                        <TableCell>{row.item?.offer_id || '-'}</TableCell>
                        <TableCell align="right">
                          {row.seller_price_per_instance 
                            ? `${row.seller_price_per_instance.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽`
                            : '-'}
                        </TableCell>
                        <TableCell align="right">
                          {row.delivery_commission?.total 
                            ? `${row.delivery_commission.total.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽`
                            : '-'}
                        </TableCell>
                        <TableCell align="right">
                          {row.return_commission?.total 
                            ? `${row.return_commission.total.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽`
                            : '-'}
                        </TableCell>
                        <TableCell align="right">
                          {row.commission_ratio 
                            ? `${(row.commission_ratio * 100).toFixed(2)}%`
                            : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Alert severity="info">Нет данных за выбранную дату</Alert>
            )}
          </Paper>
        )}
      </Box>
    </LocalizationProvider>
  );
};

export default OzonFinance;

