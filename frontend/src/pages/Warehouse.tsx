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
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  useMediaQuery,
  IconButton,
  InputAdornment
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  UploadFile as UploadFileIcon,
  Search as SearchIcon,
  Clear as ClearIcon
} from '@mui/icons-material';
import api from '../services/api';
import { WarehouseItem } from '../types';
import { useThemeContext } from '../contexts/ThemeContext';
import toast from 'react-hot-toast';

const Warehouse: React.FC = () => {
  const [items, setItems] = useState<WarehouseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WarehouseItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    quantity: '',
    article: '',
    price: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
  const { theme } = useThemeContext();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const response = await api.get('/warehouse', {
        params: searchTerm ? { search: searchTerm } : {}
      });
      setItems(response.data);
    } catch (error) {
      toast.error('Ошибка при загрузке товаров');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchItems();
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const handleOpenDialog = () => {
    setDialogOpen(true);
    setFormData({ name: '', quantity: '', article: '', price: '' });
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setFormData({ name: '', quantity: '', article: '', price: '' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      await api.post('/warehouse', formData);
      toast.success('Товар добавлен');
      handleCloseDialog();
      fetchItems();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Ошибка при добавлении товара');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (item: WarehouseItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      quantity: item.quantity?.toString() || '',
      article: item.article || '',
      price: item.price?.toString() || ''
    });
    setEditDialogOpen(true);
  };

  const handleCloseEditDialog = () => {
    setEditDialogOpen(false);
    setEditingItem(null);
    setFormData({ name: '', quantity: '', article: '', price: '' });
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    setSubmitting(true);
    try {
      await api.put(`/warehouse/${editingItem._id}`, formData);
      toast.success('Товар обновлён');
      handleCloseEditDialog();
      fetchItems();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Ошибка при обновлении товара');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Вы уверены, что хотите удалить этот товар?')) {
      return;
    }

    try {
      await api.delete(`/warehouse/${id}`);
      toast.success('Товар удалён');
      fetchItems();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Ошибка при удалении товара');
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('excelFile', file);

      await api.post('/warehouse/import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      toast.success('Товары успешно импортированы');
      setImportDialogOpen(false);
      fetchItems();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Ошибка при импорте товаров');
    } finally {
      setImporting(false);
      // Сброс input
      e.target.value = '';
    }
  };

  const filteredItems = items.filter(item => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      item.name.toLowerCase().includes(searchLower) ||
      item.article?.toLowerCase().includes(searchLower)
    );
  });

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
        <Typography variant="h4" sx={{ fontSize: { xs: '1.5rem', sm: '2rem' } }}>
          Наш склад
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexDirection: { xs: 'column', sm: 'row' }, width: { xs: '100%', sm: 'auto' } }}>
          <Button
            variant="outlined"
            startIcon={<UploadFileIcon />}
            onClick={() => setImportDialogOpen(true)}
            size={isMobile ? "large" : "medium"}
            fullWidth={isMobile}
            sx={{ minHeight: { xs: 44, sm: 'auto' } }}
          >
            Импорт Excel
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenDialog}
            size={isMobile ? "large" : "medium"}
            fullWidth={isMobile}
            sx={{ minHeight: { xs: 44, sm: 'auto' } }}
          >
            Добавить товар
          </Button>
        </Box>
      </Box>

      <TextField
        fullWidth
        label="Поиск товара"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        sx={{ mb: 2 }}
        size="small"
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
          endAdornment: searchTerm && (
            <InputAdornment position="end">
              <IconButton onClick={() => setSearchTerm('')} edge="end" size="small">
                <ClearIcon />
              </IconButton>
            </InputAdornment>
          ),
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
            minWidth: { xs: 400, sm: 600 },
          }
        }}
      >
        <Table size={isMobile ? "small" : "medium"}>
          <TableHead>
            <TableRow>
              <TableCell>Наименование</TableCell>
              <TableCell align="right">Кол-во</TableCell>
              <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Артикул</TableCell>
              <TableCell align="right" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Цена</TableCell>
              <TableCell align="center" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                Действия
              </TableCell>
              <TableCell sx={{ display: { xs: 'table-cell', sm: 'none' } }}>Действия</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={isMobile ? 3 : 5} align="center">
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : filteredItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isMobile ? 3 : 5} align="center">
                  <Typography color="text.secondary">
                    Товары не найдены
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredItems.map((item) => (
                <TableRow key={item._id} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {item.name}
                    </Typography>
                    {isMobile && (
                      <Box sx={{ mt: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">
                          Артикул: {item.article || '-'} | Цена: {item.price !== undefined && item.price > 0 
                            ? `${item.price.toLocaleString('ru-RU')} ₽`
                            : '-'
                          }
                        </Typography>
                      </Box>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {item.quantity !== undefined ? item.quantity : '-'}
                  </TableCell>
                  <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                    {item.article || '-'}
                  </TableCell>
                  <TableCell align="right" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                    {item.price !== undefined && item.price > 0 
                      ? `${item.price.toLocaleString('ru-RU')} ₽`
                      : '-'
                    }
                  </TableCell>
                  <TableCell align="center" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                      <IconButton 
                        size="small" 
                        onClick={() => handleEdit(item)}
                        sx={{ minWidth: 44, minHeight: 44 }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton 
                        size="small" 
                        color="error" 
                        onClick={() => handleDelete(item._id)}
                        sx={{ minWidth: 44, minHeight: 44 }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ display: { xs: 'table-cell', sm: 'none' } }}>
                    <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column' }}>
                      <Button
                        variant="outlined"
                        startIcon={<EditIcon />}
                        onClick={() => handleEdit(item)}
                        fullWidth
                        size="small"
                        sx={{ minHeight: 36 }}
                      >
                        Редактировать
                      </Button>
                      <Button
                        variant="outlined"
                        color="error"
                        startIcon={<DeleteIcon />}
                        onClick={() => handleDelete(item._id)}
                        fullWidth
                        size="small"
                        sx={{ minHeight: 36 }}
                      >
                        Удалить
                      </Button>
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <form onSubmit={handleSubmit}>
          <DialogTitle>Добавить товар</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              label="Наименование *"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              margin="normal"
              required
              InputProps={{
                style: { textTransform: 'none' }
              }}
              inputProps={{
                style: { textTransform: 'none' }
              }}
            />
            <TextField
              fullWidth
              label="Кол-во"
              type="number"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
              margin="normal"
              InputProps={{
                style: { textTransform: 'none' }
              }}
              inputProps={{
                style: { textTransform: 'none' }
              }}
            />
            <TextField
              fullWidth
              label="Артикул"
              value={formData.article}
              onChange={(e) => setFormData({ ...formData, article: e.target.value })}
              margin="normal"
              InputProps={{
                style: { textTransform: 'none' }
              }}
              inputProps={{
                style: { textTransform: 'none' }
              }}
            />
            <TextField
              fullWidth
              label="Цена"
              type="number"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              margin="normal"
              InputProps={{
                style: { textTransform: 'none' }
              }}
              inputProps={{
                style: { textTransform: 'none' }
              }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog} disabled={submitting} size={isMobile ? "large" : "medium"}>
              Отмена
            </Button>
            <Button type="submit" variant="contained" disabled={submitting} size={isMobile ? "large" : "medium"}>
              {submitting ? <CircularProgress size={24} /> : 'Добавить'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onClose={handleCloseEditDialog} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <form onSubmit={handleUpdate}>
          <DialogTitle>Редактировать товар</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              label="Наименование *"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              margin="normal"
              required
              InputProps={{
                style: { textTransform: 'none' }
              }}
              inputProps={{
                style: { textTransform: 'none' }
              }}
            />
            <TextField
              fullWidth
              label="Кол-во"
              type="number"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
              margin="normal"
              InputProps={{
                style: { textTransform: 'none' }
              }}
              inputProps={{
                style: { textTransform: 'none' }
              }}
            />
            <TextField
              fullWidth
              label="Артикул"
              value={formData.article}
              onChange={(e) => setFormData({ ...formData, article: e.target.value })}
              margin="normal"
              InputProps={{
                style: { textTransform: 'none' }
              }}
              inputProps={{
                style: { textTransform: 'none' }
              }}
            />
            <TextField
              fullWidth
              label="Цена"
              type="number"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              margin="normal"
              InputProps={{
                style: { textTransform: 'none' }
              }}
              inputProps={{
                style: { textTransform: 'none' }
              }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseEditDialog} disabled={submitting} size={isMobile ? "large" : "medium"}>
              Отмена
            </Button>
            <Button type="submit" variant="contained" disabled={submitting} size={isMobile ? "large" : "medium"}>
              {submitting ? <CircularProgress size={24} /> : 'Сохранить'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onClose={() => setImportDialogOpen(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle>Импорт товаров из Excel</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Формат Excel файла:
            <br />A - Наименование
            <br />B - Кол-во
            <br />C - Артикул
            <br />D - Цена
          </Typography>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleImport}
            style={{ display: 'none' }}
            id="excel-import-input"
            disabled={importing}
          />
          <label htmlFor="excel-import-input">
            <Button
              variant="outlined"
              component="span"
              startIcon={<UploadFileIcon />}
              fullWidth
              size="large"
              disabled={importing}
              sx={{ minHeight: 44 }}
            >
              {importing ? 'Импорт...' : 'Выбрать Excel файл'}
            </Button>
          </label>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportDialogOpen(false)} disabled={importing} size={isMobile ? "large" : "medium"}>
            Закрыть
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Warehouse;

