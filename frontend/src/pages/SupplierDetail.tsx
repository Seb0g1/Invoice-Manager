import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Button,
  CircularProgress,
  Card,
  CardContent,
  Grid,
  Chip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  useMediaQuery,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Payment as PaymentIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import api from '../services/api';
import { SupplierDetails, Invoice } from '../types';
import PaymentModal from '../components/PaymentModal';
import PhotoModal from '../components/PhotoModal';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import { useCurrencyStore } from '../store/currencyStore';
import { useThemeContext } from '../contexts/ThemeContext';
import toast from 'react-hot-toast';

const SupplierDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { mode, theme } = useThemeContext();
  const { currency, convertToDisplay, getCurrencySymbol } = useCurrencyStore();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [details, setDetails] = useState<SupplierDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [currentPhotoUrl, setCurrentPhotoUrl] = useState('');
  const [deleteInvoiceModalOpen, setDeleteInvoiceModalOpen] = useState(false);
  const [deleteSupplierModalOpen, setDeleteSupplierModalOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [invoiceTypeFilter, setInvoiceTypeFilter] = useState<'all' | 'income' | 'return'>('all');

  useEffect(() => {
    if (id) {
      fetchSupplierDetails();
    }
  }, [id]);

  const fetchSupplierDetails = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/suppliers/${id}`);
      setDetails(response.data);
    } catch (error) {
      toast.error('Ошибка при загрузке данных поставщика');
    } finally {
      setLoading(false);
    }
  };

  const handleInvoiceSelect = (invoiceId: string) => {
    setSelectedInvoices((prev) =>
      prev.includes(invoiceId)
        ? prev.filter((id) => id !== invoiceId)
        : [...prev, invoiceId]
    );
  };

  const handleSelectAll = () => {
    if (!details) return;
    const unpaidInvoices = details.invoices.filter((inv) => !inv.paid);
    const allSelected = unpaidInvoices.every((inv) =>
      selectedInvoices.includes(inv._id)
    );

    if (allSelected) {
      setSelectedInvoices([]);
    } else {
      setSelectedInvoices(unpaidInvoices.map((inv) => inv._id));
    }
  };

  const handlePaymentConfirm = async (
    type: 'selected' | 'one' | 'all',
    invoiceId?: string
  ) => {
    if (!id || !details) return;

    let invoiceIds: string[] | 'all';

    if (type === 'selected') {
      invoiceIds = selectedInvoices;
      if (invoiceIds.length === 0) {
        toast.error('Выберите накладные для оплаты');
        return;
      }
    } else if (type === 'one') {
      if (!invoiceId) return;
      invoiceIds = [invoiceId];
    } else {
      invoiceIds = 'all';
    }

    try {
      await api.put(`/suppliers/${id}/pay`, { invoiceIds });
      toast.success('Накладные оплачены');
      await fetchSupplierDetails();
      setSelectedInvoices([]);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Ошибка при оплате');
    }
  };

  const handlePhotoClick = (photoUrl: string) => {
    setCurrentPhotoUrl(photoUrl);
    setPhotoModalOpen(true);
  };

  const handleDeleteInvoice = (invoice: Invoice) => {
    setInvoiceToDelete(invoice);
    setDeleteInvoiceModalOpen(true);
  };

  const handleDeleteInvoiceConfirm = async () => {
    if (!invoiceToDelete || !id) return;

    try {
      setDeleting(true);
      const invoiceDate = format(new Date(invoiceToDelete.date), 'dd.MM.yyyy');
      await api.delete(`/invoices/${invoiceToDelete._id}`, {
        data: { confirmDate: invoiceDate }
      });
      toast.success('Накладная удалена');
      await fetchSupplierDetails();
      setDeleteInvoiceModalOpen(false);
      setInvoiceToDelete(null);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Ошибка при удалении накладной');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteSupplier = () => {
    setDeleteSupplierModalOpen(true);
  };

  const handleDeleteSupplierConfirm = async () => {
    if (!id || !details) return;

    try {
      setDeleting(true);
      await api.delete(`/suppliers/${id}`, {
        data: { confirmName: details.supplier.name }
      });
      toast.success('Поставщик удалён');
      navigate('/suppliers');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Ошибка при удалении поставщика');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (!details) {
    return (
      <Box>
        <Typography>Поставщик не найден</Typography>
      </Box>
    );
  }

  const { supplier, invoices, balanceHistory, exchangeRate } = details;
  
  // Фильтруем накладные по типу
  const filteredInvoices = invoices.filter((inv) => {
    if (invoiceTypeFilter === 'all') return true;
    if (invoiceTypeFilter === 'income') return inv.type !== 'return';
    if (invoiceTypeFilter === 'return') return inv.type === 'return';
    return true;
  });
  
  const unpaidInvoices = filteredInvoices.filter((inv) => !inv.paid);

  const displayBalance = convertToDisplay(
    supplier.balance,
    supplier.balanceUSD
  );
  const currencySymbol = getCurrencySymbol();

  // Подготовка данных для графиков
  const chartData = balanceHistory.map((item) => ({
    date: format(new Date(item.date), 'dd.MM.yyyy'),
    fullDate: item.date,
    balance: item.newBalance,
    balanceUSD: item.newBalanceUSD || item.newBalance / (exchangeRate || 90),
    change: item.change,
    changeUSD: item.changeUSD || item.change / (exchangeRate || 90),
  }));

  const totalUnpaidRUB = unpaidInvoices.reduce(
    (sum, inv) => sum + (inv.amountRUB || 0),
    0
  );
  const totalUnpaidUSD = unpaidInvoices.reduce(
    (sum, inv) => sum + (inv.amountUSD || 0),
    0
  );
  const displayUnpaid = convertToDisplay(totalUnpaidRUB, totalUnpaidUSD);

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2, md: 3 } }}>
      <Box sx={{ 
        display: 'flex', 
        flexDirection: { xs: 'column', sm: 'row' },
        alignItems: { xs: 'flex-start', sm: 'center' }, 
        mb: 3,
        gap: 2
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', width: { xs: '100%', sm: 'auto' } }}>
          <IconButton onClick={() => navigate('/suppliers')} sx={{ mr: { xs: 1, sm: 2 } }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography 
            variant="h4" 
            sx={{ 
              flexGrow: 1, 
              fontWeight: 700,
              fontSize: { xs: '1.25rem', sm: '1.5rem', md: '2.125rem' }
            }}
          >
            {supplier.name}
          </Typography>
        </Box>
        <Box sx={{ 
          display: 'flex', 
          gap: 1, 
          flexDirection: { xs: 'column', sm: 'row' },
          width: { xs: '100%', sm: 'auto' }
        }}>
          {unpaidInvoices.length > 0 && (
            <Button
              variant="contained"
              startIcon={<PaymentIcon />}
              onClick={() => setPaymentModalOpen(true)}
              fullWidth={isMobile}
              size={isMobile ? "large" : "medium"}
              sx={{ minHeight: { xs: 44, sm: 'auto' } }}
            >
              Оплатить
            </Button>
          )}
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={handleDeleteSupplier}
            fullWidth={isMobile}
            size={isMobile ? "large" : "medium"}
            sx={{ minHeight: { xs: 44, sm: 'auto' } }}
          >
            Удалить поставщика
          </Button>
        </Box>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={4}>
          <Card
            sx={{
              background: mode === 'dark'
                ? 'linear-gradient(135deg, rgba(10, 132, 255, 0.3) 0%, rgba(90, 200, 250, 0.3) 100%)'
                : 'linear-gradient(135deg, rgba(0, 122, 255, 0.2) 0%, rgba(90, 200, 250, 0.2) 100%)',
              color: mode === 'dark' ? '#FFFFFF' : '#000000',
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            }}
          >
            <CardContent>
              <Typography variant="subtitle2" sx={{ opacity: 0.9, mb: 1 }}>
                Текущий баланс
              </Typography>
              <Typography variant="h3" sx={{ fontWeight: 700, mb: 1, fontSize: { xs: '1.75rem', sm: '2.5rem', md: '3rem' } }}>
                {currencySymbol} {displayBalance.toLocaleString('ru-RU', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </Typography>
              {supplier.balance > 0 ? (
                <Chip
                  icon={<TrendingUpIcon />}
                  label="Долг"
                  color="error"
                  sx={{ bgcolor: 'rgba(255, 255, 255, 0.2)' }}
                />
              ) : (
                <Chip
                  icon={<TrendingDownIcon />}
                  label="Оплачено"
                  color="success"
                  sx={{ bgcolor: 'rgba(255, 255, 255, 0.2)' }}
                />
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Неоплаченных накладных
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 700, mb: 1, fontSize: { xs: '1.5rem', sm: '2rem' } }}>
                {unpaidInvoices.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                На сумму: {currencySymbol} {displayUnpaid.toLocaleString('ru-RU', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Курс доллара (ЦБ РФ)
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 700, fontSize: { xs: '1.5rem', sm: '2rem' } }}>
                {exchangeRate?.toFixed(2) || '—'} ₽
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Обновляется автоматически
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Paper 
        sx={{ 
          p: 3, 
          mb: 3,
          background: mode === 'dark'
            ? 'rgba(30, 30, 30, 0.7)'
            : 'rgba(255, 255, 255, 0.7)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        }}
      >
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
          График изменения баланса
        </Typography>
        <ResponsiveContainer width="100%" height={isMobile ? 300 : 450}>
          <AreaChart 
            data={chartData}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorBalanceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={mode === 'dark' ? '#0A84FF' : '#007AFF'}
                  stopOpacity={0.8}
                />
                <stop
                  offset="50%"
                  stopColor={mode === 'dark' ? '#5AC8FA' : '#5AC8FA'}
                  stopOpacity={0.4}
                />
                <stop
                  offset="100%"
                  stopColor={mode === 'dark' ? '#0A84FF' : '#007AFF'}
                  stopOpacity={0}
                />
              </linearGradient>
              <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
                <feOffset dx="0" dy="2" result="offsetblur" />
                <feComponentTransfer>
                  <feFuncA type="linear" slope="0.3" />
                </feComponentTransfer>
                <feMerge>
                  <feMergeNode />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke={mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}
              vertical={false}
            />
            <XAxis 
              dataKey="date" 
              stroke={mode === 'dark' ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)'}
              style={{ fontSize: '12px' }}
            />
            <YAxis 
              stroke={mode === 'dark' ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)'}
              style={{ fontSize: '12px' }}
              tickFormatter={(value) => 
                `${currencySymbol}${(value / 1000).toFixed(0)}k`
              }
            />
            <Tooltip
              contentStyle={{
                background: mode === 'dark'
                  ? 'rgba(30, 30, 30, 0.95)'
                  : 'rgba(255, 255, 255, 0.95)',
                border: mode === 'dark'
                  ? '1px solid rgba(255, 255, 255, 0.1)'
                  : '1px solid rgba(0, 0, 0, 0.1)',
                borderRadius: '12px',
                backdropFilter: 'blur(10px)',
              }}
              formatter={(value: number) => [
                `${currencySymbol} ${value.toLocaleString('ru-RU', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`,
                'Баланс'
              ]}
              labelStyle={{ color: mode === 'dark' ? '#FFFFFF' : '#000000' }}
            />
            <Area
              type="monotone"
              dataKey={currency === 'USD' ? 'balanceUSD' : 'balance'}
              stroke={mode === 'dark' ? '#0A84FF' : '#007AFF'}
              strokeWidth={3}
              fill="url(#colorBalanceGradient)"
              fillOpacity={0.6}
              name="Баланс"
              animationDuration={1000}
              animationBegin={0}
              dot={{ fill: mode === 'dark' ? '#0A84FF' : '#007AFF', r: 4 }}
              activeDot={{ r: 6, fill: mode === 'dark' ? '#5AC8FA' : '#5AC8FA' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </Paper>

      <Paper 
        sx={{ 
          p: 3,
          background: mode === 'dark'
            ? 'rgba(30, 30, 30, 0.7)'
            : 'rgba(255, 255, 255, 0.7)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, fontSize: { xs: '1rem', sm: '1.25rem' } }}>
            Все накладные ({filteredInvoices.length})
          </Typography>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Тип накладной</InputLabel>
            <Select
              value={invoiceTypeFilter}
              onChange={(e) => setInvoiceTypeFilter(e.target.value as 'all' | 'income' | 'return')}
              label="Тип накладной"
            >
              <MenuItem value="all">Все</MenuItem>
              <MenuItem value="income">Приход</MenuItem>
              <MenuItem value="return">Возврат</MenuItem>
            </Select>
          </FormControl>
        </Box>
        {unpaidInvoices.length > 0 && (
          <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Checkbox
              checked={
                unpaidInvoices.length > 0 &&
                unpaidInvoices.every((inv) => selectedInvoices.includes(inv._id))
              }
              indeterminate={
                selectedInvoices.length > 0 &&
                selectedInvoices.length < unpaidInvoices.length
              }
              onChange={handleSelectAll}
              size={isMobile ? "medium" : "small"}
            />
            <Typography variant="body2" component="span">
              Выбрать все неоплаченные ({unpaidInvoices.length})
            </Typography>
          </Box>
        )}
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" sx={{ display: { xs: 'none', sm: 'table-cell' } }} />
                <TableCell>Фото</TableCell>
                <TableCell>Дата</TableCell>
                <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Тип</TableCell>
                <TableCell align="right">Сумма</TableCell>
                <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Статус</TableCell>
                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Комментарий</TableCell>
                <TableCell align="center" sx={{ display: { xs: 'table-cell', sm: 'table-cell' } }}>Действия</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredInvoices.length === 0 ? (
                <TableRow>
                      <TableCell colSpan={isMobile ? 6 : 7} align="center">
                    <Typography color="text.secondary">
                      Нет накладных
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredInvoices.map((invoice) => {
                  const displayAmount = convertToDisplay(
                    invoice.amountRUB || 0,
                    invoice.amountUSD
                  );
                  return (
                    <TableRow key={invoice._id} hover>
                      <TableCell padding="checkbox" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                        {!invoice.paid && (
                          <Checkbox
                            checked={selectedInvoices.includes(invoice._id)}
                            onChange={() => handleInvoiceSelect(invoice._id)}
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        {invoice.photoUrl ? (
                          <Box
                            component="img"
                            src={invoice.photoUrl}
                            alt="Invoice"
                            sx={{
                              width: { xs: 60, sm: 80 },
                              height: { xs: 60, sm: 80 },
                              objectFit: 'cover',
                              cursor: 'pointer',
                              borderRadius: 2,
                              transition: 'transform 0.2s',
                              '&:active': {
                                transform: 'scale(0.95)',
                              },
                            }}
                            onClick={() => handlePhotoClick(invoice.photoUrl!)}
                          />
                        ) : (
                          <Box
                            sx={{
                              width: { xs: 60, sm: 80 },
                              height: { xs: 60, sm: 80 },
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              bgcolor: 'grey.200',
                              borderRadius: 2,
                            }}
                          >
                            <Typography variant="caption" color="text.secondary">
                              Нет фото
                            </Typography>
                          </Box>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {format(new Date(invoice.date), 'dd.MM.yyyy', {
                            locale: ru,
                          })}
                        </Typography>
                        {invoice.comment && (
                          <Typography 
                            variant="caption" 
                            color="text.secondary" 
                            sx={{ 
                              display: { xs: 'block', md: 'none' },
                              mt: 0.5,
                              maxWidth: 200,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                            title={invoice.comment}
                          >
                            {invoice.comment}
                          </Typography>
                        )}
                        <Chip
                          label={invoice.paid ? 'Оплачено' : 'Не оплачено'}
                          color={invoice.paid ? 'success' : 'warning'}
                          size="small"
                          sx={{ display: { xs: 'inline-flex', sm: 'none' }, mt: 0.5 }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {currencySymbol} {displayAmount.toLocaleString('ru-RU', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </Typography>
                        {invoice.amountUSD && invoice.amountRUB && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            {currency === 'USD'
                              ? `${(invoice.amountRUB).toFixed(2)} ₽`
                              : `$${invoice.amountUSD.toFixed(2)}`}
                          </Typography>
                        )}
                        {invoice.type && (
                          <Chip
                            label={invoice.type === 'return' ? 'Возврат' : 'Приход'}
                            size="small"
                            color={invoice.type === 'return' ? 'warning' : 'default'}
                            sx={{ display: { xs: 'inline-flex', sm: 'none' }, mt: 0.5 }}
                          />
                        )}
                      </TableCell>
                      <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                        <Chip
                          label={invoice.paid ? 'Оплачено' : 'Не оплачено'}
                          color={invoice.paid ? 'success' : 'warning'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                        {invoice.comment ? (
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              maxWidth: 200,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                            title={invoice.comment}
                          >
                            {invoice.comment}
                          </Typography>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            —
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="center" sx={{ display: { xs: 'table-cell', sm: 'table-cell' } }}>
                        <IconButton
                          color="error"
                          size={isMobile ? "medium" : "small"}
                          onClick={() => handleDeleteInvoice(invoice)}
                          sx={{
                            minWidth: { xs: 44, sm: 'auto' },
                            minHeight: { xs: 44, sm: 'auto' },
                            '&:active': {
                              transform: 'scale(0.9)',
                            },
                          }}
                        >
                          <DeleteIcon fontSize={isMobile ? "medium" : "small"} />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <DeleteConfirmModal
        open={deleteInvoiceModalOpen}
        onClose={() => {
          setDeleteInvoiceModalOpen(false);
          setInvoiceToDelete(null);
        }}
        onConfirm={handleDeleteInvoiceConfirm}
        type="invoice"
        name={invoiceToDelete ? (typeof invoiceToDelete.supplier === 'object' ? invoiceToDelete.supplier.name : '') : ''}
        confirmValue={invoiceToDelete ? format(new Date(invoiceToDelete.date), 'dd.MM.yyyy') : ''}
        loading={deleting}
      />

      <DeleteConfirmModal
        open={deleteSupplierModalOpen}
        onClose={() => setDeleteSupplierModalOpen(false)}
        onConfirm={handleDeleteSupplierConfirm}
        type="supplier"
        name={supplier.name}
        confirmValue={supplier.name}
        loading={deleting}
      />

      <PaymentModal
        open={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        onConfirm={handlePaymentConfirm}
        invoices={unpaidInvoices}
        selectedInvoices={selectedInvoices}
      />

      <PhotoModal
        open={photoModalOpen}
        onClose={() => setPhotoModalOpen(false)}
        photoUrl={currentPhotoUrl}
      />
    </Box>
  );
};

export default SupplierDetail;

