import React, { useState, useEffect } from 'react';
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
  TextField,
  MenuItem,
  IconButton,
  useMediaQuery
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import api from '../services/api';
import { Supplier, Invoice } from '../types';
import InvoiceForm from '../components/InvoiceForm';
import PhotoModal from '../components/PhotoModal';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import { useAuthStore } from '../store/authStore';
import { useThemeContext } from '../contexts/ThemeContext';
import toast from 'react-hot-toast';
import { handleError } from '../utils/errorHandler';
import SkeletonLoader from '../components/SkeletonLoader';
import { useInvoices, useDeleteInvoice } from '../hooks/useInvoices';
import LazyImage from '../components/LazyImage';

const Invoices: React.FC = () => {
  const { user } = useAuthStore();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [currentPhotoUrl, setCurrentPhotoUrl] = useState('');
  const [deleteInvoiceModalOpen, setDeleteInvoiceModalOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
  const { theme } = useThemeContext();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const isDirector = user?.role === 'director';
  
  // React Query hooks
  const { data, isLoading, error } = useInvoices({
    supplier: filterSupplier || undefined,
    startDate: filterStartDate || undefined,
    endDate: filterEndDate || undefined
  });
  const deleteInvoiceMutation = useDeleteInvoice();
  
  const invoices = data?.items || [];
  const loading = isLoading;

  useEffect(() => {
    fetchSuppliers();
  }, [isDirector]);

  const fetchSuppliers = async () => {
    try {
      if (isDirector) {
        const response = await api.get('/suppliers');
        setSuppliers(response.data);
      } else {
        // Для сборщика получаем список всех поставщиков (для выбора при создании накладной)
        // В реальном приложении можно ограничить только теми, у кого есть накладные
        try {
          const response = await api.get('/suppliers');
          setSuppliers(response.data);
        } catch (error) {
          // Если нет доступа к /suppliers, используем пустой список
          setSuppliers([]);
        }
      }
    } catch (error) {
      toast.error('Ошибка при загрузке поставщиков');
    }
  };

  // Обработка ошибки запроса
  useEffect(() => {
    if (error) {
      handleError(error, 'Ошибка при загрузке накладных');
    }
  }, [error]);

  const handleSuccess = () => {
    // React Query автоматически обновит данные через invalidateQueries
    fetchSuppliers();
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
    if (!invoiceToDelete) return;

    const invoiceDate = format(new Date(invoiceToDelete.date), 'dd.MM.yyyy');
    await deleteInvoiceMutation.mutateAsync({
      id: invoiceToDelete._id,
      confirmDate: invoiceDate
    });
    setDeleteInvoiceModalOpen(false);
    setInvoiceToDelete(null);
  };

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2, md: 3 } }}>
      <Typography variant="h4" gutterBottom sx={{ fontSize: { xs: '1.5rem', sm: '2rem' } }}>
        Накладные
      </Typography>

      <InvoiceForm
        suppliers={suppliers}
        onSuccess={handleSuccess}
        showSuppliersList={true}
      />

      {isDirector && (
        <>
          <Paper sx={{ p: { xs: 1.5, sm: 2 }, mb: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
              Фильтры
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                select
                label="Поставщик"
                value={filterSupplier}
                onChange={(e) => setFilterSupplier(e.target.value)}
                sx={{ 
                  minWidth: { xs: '100%', sm: 200 },
                  flex: { xs: '1 1 100%', sm: '0 1 auto' }
                }}
                size="small"
                fullWidth={isMobile}
              >
                <MenuItem value="">Все</MenuItem>
                {suppliers.map((supplier) => (
                  <MenuItem key={supplier._id} value={supplier._id}>
                    {supplier.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                type="date"
                label="Дата от"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                size="small"
                fullWidth={isMobile}
                sx={{ flex: { xs: '1 1 100%', sm: '0 1 auto' } }}
              />
              <TextField
                type="date"
                label="Дата до"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                size="small"
                fullWidth={isMobile}
                sx={{ flex: { xs: '1 1 100%', sm: '0 1 auto' } }}
              />
            </Box>
          </Paper>

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
                <TableCell sx={{ width: { xs: 80, sm: 100 } }}>Фото</TableCell>
                <TableCell>Дата</TableCell>
                <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Поставщик</TableCell>
                <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Статус</TableCell>
                {isDirector && <TableCell align="center" sx={{ width: { xs: 80, sm: 100 } }}>Действия</TableCell>}
              </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <>
                    {Array.from({ length: 5 }).map((_, index) => (
                      <TableRow key={index}>
                        <TableCell colSpan={isDirector ? (isMobile ? 3 : 5) : (isMobile ? 2 : 4)}>
                          <SkeletonLoader variant="text" rows={1} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </>
                ) : invoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isDirector ? (isMobile ? 3 : 5) : (isMobile ? 2 : 4)} align="center">
                      <Typography color="text.secondary">
                        Накладные не найдены
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  invoices.map((invoice: Invoice) => (
                    <TableRow key={invoice._id}>
                      <TableCell>
                        {invoice.photoUrl ? (
                          <LazyImage
                            src={invoice.photoUrl}
                            alt="Invoice"
                            width={{ xs: 60, sm: 80 }}
                            height={{ xs: 60, sm: 80 }}
                            thumbnailSrc={invoice.photoUrl.replace('/uploads/', '/uploads/thumb_')}
                            onError={() => {
                              console.error('Ошибка загрузки фото:', invoice.photoUrl);
                            }}
                            sx={{
                              width: { xs: 60, sm: 80 },
                              height: { xs: 60, sm: 80 },
                              objectFit: 'cover',
                              cursor: 'pointer',
                              borderRadius: 1,
                              bgcolor: 'grey.200',
                              '&:active': {
                                transform: 'scale(0.95)',
                              },
                            }}
                            onClick={() => invoice.photoUrl && handlePhotoClick(invoice.photoUrl)}
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
                          {format(new Date(invoice.date), 'dd.MM.yyyy', { locale: ru })}
                        </Typography>
                        <Typography
                          variant="caption"
                          color={invoice.paid ? 'success.main' : 'warning.main'}
                          sx={{ display: { xs: 'block', sm: 'none' }, mt: 0.5 }}
                        >
                          {invoice.paid ? 'Оплачено' : 'Не оплачено'}
                        </Typography>
                        {typeof invoice.supplier === 'object' && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'block', sm: 'none' } }}>
                            {invoice.supplier.name}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                        {typeof invoice.supplier === 'object'
                          ? invoice.supplier.name
                          : 'Неизвестно'}
                      </TableCell>
                      <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                        <Typography
                          color={invoice.paid ? 'success.main' : 'warning.main'}
                          fontWeight="bold"
                          variant="body2"
                        >
                          {invoice.paid ? 'Оплачено' : 'Не оплачено'}
                        </Typography>
                      </TableCell>
                      {isDirector && (
                        <TableCell align="center">
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
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

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
        loading={deleteInvoiceMutation.isPending}
      />

      <PhotoModal
        open={photoModalOpen}
        onClose={() => setPhotoModalOpen(false)}
        photoUrl={currentPhotoUrl}
      />
    </Box>
  );
};

export default Invoices;

