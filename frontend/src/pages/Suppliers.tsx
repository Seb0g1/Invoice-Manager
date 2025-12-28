import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Checkbox,
  Button,
  Collapse,
  IconButton,
  CircularProgress,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useMediaQuery,
  ToggleButton,
  ToggleButtonGroup
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Payment as PaymentIcon,
  Visibility as VisibilityIcon,
  Add as AddIcon
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import api from '../services/api';
import { Supplier, SupplierDetails, Invoice } from '../types';
import PaymentModal from '../components/PaymentModal';
import PhotoModal from '../components/PhotoModal';
import { useCurrencyStore } from '../store/currencyStore';
import { useThemeContext } from '../contexts/ThemeContext';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';
import { handleError } from '../utils/errorHandler';
import { useDebounce } from '../utils/debounce';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { supplierSchema, SupplierFormData } from '../utils/validation';

const Suppliers: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { currency, convertToDisplay, getCurrencySymbol, setCurrency } = useCurrencyStore();
  const isDirector = user?.role === 'director';
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [expandedSupplier, setExpandedSupplier] = useState<string | null>(null);
  const [supplierDetails, setSupplierDetails] = useState<Record<string, SupplierDetails>>({});
  const [selectedInvoices, setSelectedInvoices] = useState<Record<string, string[]>>({});
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [currentSupplierId, setCurrentSupplierId] = useState<string | null>(null);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [currentPhotoUrl, setCurrentPhotoUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const { theme } = useThemeContext();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // React Hook Form для создания поставщика
  const {
    control: createSupplierControl,
    handleSubmit: handleCreateSupplierSubmit,
    reset: resetCreateSupplier,
    formState: { errors: createSupplierErrors, isSubmitting: creating }
  } = useForm<SupplierFormData>({
    resolver: yupResolver(supplierSchema),
    defaultValues: {
      name: ''
    }
  });

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const response = await api.get('/suppliers');
      setSuppliers(response.data);
    } catch (error) {
      handleError(error, 'Ошибка при загрузке поставщиков');
    } finally {
      setLoading(false);
    }
  };

  const fetchSupplierDetails = async (supplierId: string) => {
    try {
      const response = await api.get(`/suppliers/${supplierId}`);
      setSupplierDetails((prev) => ({
        ...prev,
        [supplierId]: response.data
      }));
    } catch (error) {
      handleError(error, 'Ошибка при загрузке деталей поставщика');
    }
  };

  const handleExpand = (supplierId: string) => {
    if (expandedSupplier === supplierId) {
      setExpandedSupplier(null);
    } else {
      setExpandedSupplier(supplierId);
      if (!supplierDetails[supplierId]) {
        fetchSupplierDetails(supplierId);
      }
    }
  };

  const handleInvoiceSelect = (supplierId: string, invoiceId: string) => {
    setSelectedInvoices((prev) => {
      const current = prev[supplierId] || [];
      if (current.includes(invoiceId)) {
        return {
          ...prev,
          [supplierId]: current.filter((id) => id !== invoiceId)
        };
      } else {
        return {
          ...prev,
          [supplierId]: [...current, invoiceId]
        };
      }
    });
  };

  const handleSelectAll = (supplierId: string, invoices: Invoice[]) => {
    const allSelected = invoices.every((inv) =>
      selectedInvoices[supplierId]?.includes(inv._id)
    );
    
    if (allSelected) {
      setSelectedInvoices((prev) => ({
        ...prev,
        [supplierId]: []
      }));
    } else {
      setSelectedInvoices((prev) => ({
        ...prev,
        [supplierId]: invoices.map((inv) => inv._id)
      }));
    }
  };

  const handlePaymentClick = (supplierId: string) => {
    setCurrentSupplierId(supplierId);
    setPaymentModalOpen(true);
  };

  const handlePaymentConfirm = async (type: 'selected' | 'one' | 'all', invoiceId?: string, customAmount?: number) => {
    if (!currentSupplierId) return;

    const details = supplierDetails[currentSupplierId];
    if (!details) return;

    let invoiceIds: string[] | 'all';

    if (type === 'selected') {
      invoiceIds = selectedInvoices[currentSupplierId] || [];
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
      await api.put(`/suppliers/${currentSupplierId}/pay`, {
        invoiceIds,
        customAmount: customAmount !== undefined ? customAmount : undefined
      });

      toast.success('Накладные оплачены');
      
      // Обновляем данные
      await fetchSuppliers();
      await fetchSupplierDetails(currentSupplierId);
      setSelectedInvoices((prev) => ({
        ...prev,
        [currentSupplierId]: []
      }));
    } catch (error) {
      handleError(error, 'Ошибка при оплате');
    }
  };

  const handlePhotoClick = (photoUrl: string) => {
    setCurrentPhotoUrl(photoUrl);
    setPhotoModalOpen(true);
  };

  const handleCreateSupplier = async (data: SupplierFormData) => {
    try {
      await api.post('/suppliers', { name: data.name.trim() });
      toast.success('Поставщик создан');
      setCreateDialogOpen(false);
      resetCreateSupplier();
      await fetchSuppliers();
    } catch (error) {
      handleError(error, 'Ошибка при создании поставщика');
    }
  };

  const filteredSuppliers = suppliers.filter((supplier) =>
    supplier.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  const details = currentSupplierId ? supplierDetails[currentSupplierId] : null;
  const unpaidInvoices = Array.isArray(details?.invoices) 
    ? details.invoices.filter((inv) => !inv.paid) 
    : [];

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2, md: 3 } }}>
      <Box sx={{ 
        display: 'flex', 
        flexDirection: { xs: 'column', sm: 'row' },
        justifyContent: 'space-between', 
        alignItems: { xs: 'flex-start', sm: 'center' },
        gap: 2,
        mb: 3 
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Typography variant="h4" sx={{ fontSize: { xs: '1.5rem', sm: '2rem' } }}>
            Поставщики
          </Typography>
          <ToggleButtonGroup
            value={currency}
            exclusive
            onChange={(_, newCurrency) => {
              if (newCurrency !== null) {
                setCurrency(newCurrency);
              }
            }}
            size="small"
            aria-label="Валюта"
          >
            <ToggleButton value="RUB" aria-label="Рубли">
              ₽ RUB
            </ToggleButton>
            <ToggleButton value="USD" aria-label="Доллары">
              $ USD
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
        {isDirector && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
            size={isMobile ? "large" : "medium"}
            fullWidth={isMobile}
            sx={{ minHeight: { xs: 44, sm: 'auto' } }}
          >
            Создать поставщика
          </Button>
        )}
      </Box>

      <TextField
        fullWidth
        label="Поиск по названию"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        sx={{ mb: 2 }}
        size="small"
        InputProps={{
          style: { textTransform: 'none' }
        }}
        inputProps={{
          style: { textTransform: 'none' }
        }}
      />

      <TableContainer 
        component={Paper}
        sx={{
          overflowX: 'auto',
          '& .MuiTable-root': {
            minWidth: 600,
          }
        }}
      >
        <Table>
          <TableHead>
            <TableRow>
              <TableCell />
              <TableCell>Название</TableCell>
              <TableCell align="right">Текущий баланс (долг) ({currency === 'USD' ? '$' : '₽'})</TableCell>
              <TableCell align="center">Действия</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredSuppliers.map((supplier) => {
              const details = supplierDetails[supplier._id];
              const unpaidInvoices = Array.isArray(details?.invoices) 
                ? details.invoices.filter((inv) => !inv.paid) 
                : [];
              const selected = selectedInvoices[supplier._id] || [];

              return (
                <React.Fragment key={supplier._id}>
                  <TableRow>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => handleExpand(supplier._id)}
                      >
                        {expandedSupplier === supplier._id ? (
                          <ExpandLessIcon />
                        ) : (
                          <ExpandMoreIcon />
                        )}
                      </IconButton>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body1" sx={{ fontWeight: 600 }}>
                          {supplier.name}
                        </Typography>
                        <IconButton
                          size={isMobile ? "medium" : "small"}
                          onClick={() => navigate(`/suppliers/${supplier._id}`)}
                          sx={{ 
                            color: 'primary.main',
                            minWidth: { xs: 44, sm: 'auto' },
                            minHeight: { xs: 44, sm: 'auto' }
                          }}
                        >
                          <VisibilityIcon fontSize={isMobile ? "medium" : "small"} />
                        </IconButton>
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Typography
                        variant="body1"
                        color={supplier.balance > 0 ? 'error' : 'success.main'}
                        fontWeight="bold"
                      >
                        {getCurrencySymbol()} {convertToDisplay(supplier.balance, supplier.balanceUSD).toLocaleString('ru-RU', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </Typography>
                      {supplier.balanceUSD && (
                        <Typography variant="caption" color="text.secondary">
                          {currency === 'USD'
                            ? `${supplier.balance.toLocaleString('ru-RU')} ₽`
                            : `$${supplier.balanceUSD.toLocaleString('ru-RU', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}`}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ 
                        display: 'flex', 
                        gap: 1, 
                        justifyContent: 'center',
                        flexDirection: { xs: 'column', sm: 'row' }
                      }}>
                        <Button
                          variant="outlined"
                          size={isMobile ? "medium" : "small"}
                          onClick={() => navigate(`/suppliers/${supplier._id}`)}
                          fullWidth={isMobile}
                          sx={{ 
                            minHeight: { xs: 44, sm: 'auto' },
                            minWidth: { xs: '100%', sm: 'auto' }
                          }}
                        >
                          Детали
                        </Button>
                        {unpaidInvoices.length > 0 && isDirector && (
                          <Button
                            variant="contained"
                            startIcon={<PaymentIcon />}
                            onClick={() => handlePaymentClick(supplier._id)}
                            size={isMobile ? "medium" : "small"}
                            fullWidth={isMobile}
                            sx={{ 
                              minHeight: { xs: 44, sm: 'auto' },
                              minWidth: { xs: '100%', sm: 'auto' }
                            }}
                          >
                            Оплатить
                          </Button>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={4} sx={{ py: 0, px: { xs: 1, sm: 2 } }}>
                      <Collapse in={expandedSupplier === supplier._id}>
                        <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
                          {details ? (
                            <>
                              {unpaidInvoices.length > 0 ? (
                                <>
                                  {isDirector && (
                                    <Box sx={{ mb: 2, display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                                      <Checkbox
                                        checked={
                                          unpaidInvoices.length > 0 &&
                                          unpaidInvoices.every((inv) =>
                                            selected.includes(inv._id)
                                          )
                                        }
                                        indeterminate={
                                          selected.length > 0 &&
                                          selected.length < unpaidInvoices.length
                                        }
                                        onChange={() =>
                                          handleSelectAll(supplier._id, unpaidInvoices)
                                        }
                                        size={isMobile ? "medium" : "small"}
                                      />
                                      <Typography variant="subtitle2" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                                        Выбрать все ({unpaidInvoices.length})
                                      </Typography>
                                    </Box>
                                  )}
                                  <Table size={isMobile ? "small" : "small"}>
                                    <TableHead>
                                      <TableRow>
                                        {isDirector && (
                                          <TableCell padding="checkbox" sx={{ display: { xs: 'none', sm: 'table-cell' } }} />
                                        )}
                                        <TableCell>Фото</TableCell>
                                        <TableCell>Дата</TableCell>
                                        {isDirector && (
                                          <TableCell sx={{ display: { xs: 'table-cell', sm: 'none' } }} padding="checkbox" />
                                        )}
                                      </TableRow>
                                    </TableHead>
                                    <TableBody>
                                      {unpaidInvoices.map((invoice) => (
                                        <TableRow key={invoice._id}>
                                          {isDirector && (
                                            <TableCell padding="checkbox" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                                              <Checkbox
                                                checked={selected.includes(invoice._id)}
                                                onChange={() =>
                                                  handleInvoiceSelect(supplier._id, invoice._id)
                                                }
                                                size={isMobile ? "medium" : "small"}
                                              />
                                            </TableCell>
                                          )}
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
                                                  borderRadius: 1
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
                                                  borderRadius: 1,
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
                                                locale: ru
                                              })}
                                            </Typography>
                                          </TableCell>
                                          {isDirector && (
                                            <TableCell padding="checkbox" sx={{ display: { xs: 'table-cell', sm: 'none' } }}>
                                              <Checkbox
                                                checked={selected.includes(invoice._id)}
                                                onChange={() =>
                                                  handleInvoiceSelect(supplier._id, invoice._id)
                                                }
                                                size="medium"
                                              />
                                            </TableCell>
                                          )}
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </>
                              ) : (
                                <Typography color="text.secondary">
                                  Нет неоплаченных накладных
                                </Typography>
                              )}

                              {details.balanceHistory.length > 0 && (
                                <Box sx={{ mt: 4 }}>
                                  <Typography variant="h6" gutterBottom>
                                    График изменения баланса
                                  </Typography>
                                  <ResponsiveContainer width="100%" height={isMobile ? 250 : 300}>
                                    <LineChart data={details.balanceHistory}>
                                      <CartesianGrid strokeDasharray="3 3" />
                                      <XAxis
                                        dataKey="date"
                                        tickFormatter={(value) =>
                                          format(new Date(value), 'dd.MM.yyyy')
                                        }
                                      />
                                      <YAxis />
                                      <Tooltip
                                        labelFormatter={(value) =>
                                          format(new Date(value), 'dd.MM.yyyy HH:mm')
                                        }
                                      />
                                      <Legend />
                                      <Line
                                        type="monotone"
                                        dataKey="newBalance"
                                        stroke="#1976d2"
                                        name="Баланс"
                                        strokeWidth={2}
                                      />
                                    </LineChart>
                                  </ResponsiveContainer>
                                </Box>
                              )}
                            </>
                          ) : (
                            <CircularProgress size={24} />
                          )}
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <PaymentModal
        open={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        onConfirm={handlePaymentConfirm}
        invoices={unpaidInvoices}
        selectedInvoices={selectedInvoices[currentSupplierId || ''] || []}
      />

      <PhotoModal
        open={photoModalOpen}
        onClose={() => setPhotoModalOpen(false)}
        photoUrl={currentPhotoUrl}
      />

      {/* Диалог создания поставщика */}
      <Dialog
        open={createDialogOpen}
        onClose={() => {
          setCreateDialogOpen(false);
          resetCreateSupplier();
        }}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
      >
        <form onSubmit={handleCreateSupplierSubmit(handleCreateSupplier)}>
          <DialogTitle>Создать поставщика</DialogTitle>
          <DialogContent>
            <Controller
              name="name"
              control={createSupplierControl}
              render={({ field }: { field: any }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="Название поставщика *"
                  margin="normal"
                  required
                  autoFocus
                  size={isMobile ? "small" : "medium"}
                  placeholder="Введите название поставщика"
                  error={!!createSupplierErrors.name}
                  helperText={createSupplierErrors.name?.message}
                  InputProps={{
                    style: { textTransform: 'none' }
                  }}
                  inputProps={{
                    style: { textTransform: 'none' }
                  }}
                />
              )}
            />
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setCreateDialogOpen(false);
                resetCreateSupplier();
              }}
              disabled={creating}
              size={isMobile ? "large" : "medium"}
            >
              Отмена
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={creating}
              size={isMobile ? "large" : "medium"}
            >
              {creating ? <CircularProgress size={24} /> : 'Создать'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default Suppliers;

