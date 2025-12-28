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
  InputAdornment,
  Checkbox,
  Toolbar,
  Pagination,
  FormControl,
  Select,
  MenuItem,
  InputLabel
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  UploadFile as UploadFileIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  Warning as WarningIcon,
  FileDownload as FileDownloadIcon
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import api from '../services/api';
import { WarehouseItem } from '../types';
import { useThemeContext } from '../contexts/ThemeContext';
import toast from 'react-hot-toast';
import { handleError } from '../utils/errorHandler';
import { warehouseItemSchema, WarehouseItemFormData } from '../utils/validation';
import SkeletonLoader from '../components/SkeletonLoader';
import { 
  useWarehouseItems, 
  useCreateWarehouseItem, 
  useUpdateWarehouseItem, 
  useDeleteWarehouseItem,
  useDeleteWarehouseItems 
} from '../hooks/useWarehouseItems';
import { useDebounce } from '../utils/debounce';
import { useQueryClient } from '@tanstack/react-query';
import LowStockAlert from '../components/LowStockAlert';

const Warehouse: React.FC = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importMode, setImportMode] = useState<'add' | 'replace' | 'remove' | 'delete'>('add');
  const [editingItem, setEditingItem] = useState<WarehouseItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [categories, setCategories] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  
  // Debounced search term
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  
  // React Query hooks
  const queryClient = useQueryClient();
  const { data, isLoading } = useWarehouseItems(page, itemsPerPage, debouncedSearchTerm, categoryFilter);
  const createMutation = useCreateWarehouseItem();
  const updateMutation = useUpdateWarehouseItem();
  const deleteMutation = useDeleteWarehouseItem();
  const deleteManyMutation = useDeleteWarehouseItems();
  
  const items = (data as any)?.items || [];
  const totalPages = (data as any)?.pagination?.totalPages || 1;
  const totalItems = (data as any)?.pagination?.total || 0;
  const loading = isLoading;
  
  // Логируем данные для отладки
  useEffect(() => {
    if (items.length > 0) {
      const testItem = items.find((item: any) => 
        item.name === 'A.Dunhill Icon Racing Men 100 мл парфюмерная вода' || item.article === '35515'
      );
      if (testItem) {
        console.log('[Frontend Warehouse] Товар найден в items:', {
          name: testItem.name,
          quantity: testItem.quantity,
          quantityType: typeof testItem.quantity,
          quantityValue: testItem.quantity,
          article: testItem.article,
          _id: testItem._id,
          fullItem: JSON.stringify(testItem)
        });
        
        // Проверяем, не умножается ли где-то
        if (testItem.quantity === 10 && testItem.quantity !== 1) {
          console.error('[Frontend Warehouse] ⚠️ ОШИБКА: Количество = 10, но должно быть 1!');
        }
      }
    }
  }, [items]);
  
  // React Hook Form для создания
  const {
    control: createControl,
    handleSubmit: handleCreateSubmit,
    reset: resetCreate,
    formState: { errors: createErrors }
  } = useForm<WarehouseItemFormData>({
    resolver: yupResolver(warehouseItemSchema),
    defaultValues: {
      name: '',
      quantity: null,
      article: null,
      price: null,
      category: null,
      lowStockThreshold: null
    }
  });

  // React Hook Form для редактирования
  const {
    control: editControl,
    handleSubmit: handleEditSubmit,
    reset: resetEdit,
    formState: { errors: editErrors }
  } = useForm<WarehouseItemFormData>({
    resolver: yupResolver(warehouseItemSchema),
    defaultValues: {
      name: '',
      quantity: null,
      article: null,
      price: null,
      category: null,
      lowStockThreshold: null
    }
  });
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  // Загрузка категорий
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await api.get('/warehouse/categories');
        setCategories(response.data.categories || []);
      } catch (error) {
        console.error('Ошибка загрузки категорий:', error);
      }
    };
    fetchCategories();
  }, []);
  const { theme } = useThemeContext();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  useEffect(() => {
    setPage(1); // Сбрасываем на первую страницу при поиске или изменении фильтра
  }, [debouncedSearchTerm, categoryFilter]);

  const handleOpenDialog = () => {
    resetCreate();
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    resetCreate();
  };

  const handleCreate = async (data: WarehouseItemFormData) => {
    const payload = {
      name: data.name,
      quantity: data.quantity ?? undefined,
      article: data.article ?? undefined,
      price: data.price ?? undefined,
      category: data.category ?? undefined,
      lowStockThreshold: data.lowStockThreshold ?? undefined
    };
    
    await createMutation.mutateAsync(payload);
    handleCloseDialog();
    // Обновляем список категорий после создания товара
    const response = await api.get('/warehouse/categories');
    setCategories(response.data.categories || []);
  };

  const handleEdit = (item: WarehouseItem) => {
    setEditingItem(item);
    resetEdit({
      name: item.name,
      quantity: item.quantity ?? null,
      article: item.article ?? null,
      price: item.price ?? null,
      category: item.category ?? null,
      lowStockThreshold: item.lowStockThreshold ?? null
    });
    setEditDialogOpen(true);
  };

  const handleCloseEditDialog = () => {
    setEditDialogOpen(false);
    setEditingItem(null);
    resetEdit();
  };

  const handleUpdate = async (data: WarehouseItemFormData) => {
    if (!editingItem) return;

    const payload = {
      name: data.name,
      quantity: data.quantity ?? undefined,
      article: data.article ?? undefined,
      price: data.price ?? undefined,
      category: data.category ?? undefined,
      lowStockThreshold: data.lowStockThreshold ?? undefined
    };
    
    await updateMutation.mutateAsync({ id: editingItem._id, data: payload });
    handleCloseEditDialog();
    // Обновляем список категорий после обновления товара
    const response = await api.get('/warehouse/categories');
    setCategories(response.data.categories || []);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Вы уверены, что хотите удалить этот товар?')) {
      return;
    }

    await deleteMutation.mutateAsync(id);
  };

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedItems(filteredItems.map((item: WarehouseItem) => item._id));
    } else {
      setSelectedItems([]);
    }
  };

  const handleSelectAllItems = async () => {
    try {
      // Получаем все ID товаров с учетом текущих фильтров
      const params: any = {};
      if (debouncedSearchTerm) {
        params.search = debouncedSearchTerm;
      }
      if (categoryFilter) {
        params.category = categoryFilter;
      }

      const response = await api.get('/warehouse/ids', { params });
      
      // Безопасная обработка ответа
      let allIds: string[] = [];
      if (response?.data) {
        if (Array.isArray(response.data.ids)) {
          allIds = response.data.ids.map((id: any) => String(id));
        } else if (Array.isArray(response.data)) {
          // Если ответ пришел как массив напрямую
          allIds = response.data.map((id: any) => String(id));
        }
      }
      
      if (allIds.length === 0) {
        toast('Нет товаров для выбора');
        return;
      }
      
      setSelectedItems(allIds);
      toast.success(`Выбрано товаров: ${allIds.length}`);
    } catch (error: any) {
      console.error('Ошибка при выборе всех товаров:', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Неизвестная ошибка';
      handleError(error, `Ошибка при выборе всех товаров: ${errorMessage}`);
    }
  };

  const handleSelectItem = (id: string) => {
    setSelectedItems(prev => 
      prev.includes(id) 
        ? prev.filter(itemId => itemId !== id)
        : [...prev, id]
    );
  };

  const handleDeleteSelected = async () => {
    if (selectedItems.length === 0) return;
    
    const confirmMessage = selectedItems.length === 1
      ? 'Вы уверены, что хотите удалить выбранный товар?'
      : `Вы уверены, что хотите удалить ${selectedItems.length} товаров?`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    await deleteManyMutation.mutateAsync(selectedItems);
    setSelectedItems([]);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('excelFile', file);
      formData.append('mode', importMode);

      const response = await api.post('/warehouse/import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      const message = response.data.message || 'Операция завершена успешно';
      toast.success(message);
      setImportDialogOpen(false);
      // Принудительно очищаем кэш и перезагружаем данные
      queryClient.removeQueries({ queryKey: ['warehouseItems'] });
      await queryClient.refetchQueries({ queryKey: ['warehouseItems'] });
    } catch (error) {
      handleError(error, 'Ошибка при импорте товаров');
    } finally {
      setImporting(false);
      // Сброс input
      e.target.value = '';
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params: any = {};
      if (debouncedSearchTerm) {
        params.search = debouncedSearchTerm;
      }
      if (categoryFilter) {
        params.category = categoryFilter;
      }

      const response = await api.get('/warehouse/export', {
        params,
        responseType: 'blob'
      });

      // Создаем ссылку для скачивания
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const filename = `warehouse-export-${new Date().toISOString().split('T')[0]}.xlsx`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('Экспорт завершен успешно');
    } catch (error) {
      handleError(error, 'Ошибка при экспорте склада');
    } finally {
      setExporting(false);
    }
  };

  // Фильтрация теперь на сервере, но оставляем для обратной совместимости
  const filteredItems = items;

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2, md: 3 } }}>
      <LowStockAlert />
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
            startIcon={<FileDownloadIcon />}
            onClick={handleExport}
            disabled={exporting || totalItems === 0}
            size={isMobile ? "large" : "medium"}
            fullWidth={isMobile}
            sx={{ minHeight: { xs: 44, sm: 'auto' } }}
          >
            {exporting ? 'Экспорт...' : 'Экспорт Excel'}
          </Button>
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

      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
        <TextField
          fullWidth
          label="Поиск товара"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
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
        <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 200 } }}>
          <InputLabel>Категория</InputLabel>
          <Select
            value={categoryFilter}
            label="Категория"
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
          >
            <MenuItem value="">Все категории</MenuItem>
            {categories.map((cat) => (
              <MenuItem key={cat} value={cat}>
                {cat}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {selectedItems.length > 0 && (
        <Toolbar
          sx={{
            pl: { sm: 2 },
            pr: { xs: 1, sm: 1 },
            bgcolor: 'action.selected',
            borderRadius: 1,
            mb: 2
          }}
        >
          <Typography
            sx={{ flex: '1 1 100%' }}
            color="inherit"
            variant="subtitle1"
            component="div"
          >
            Выбрано: {selectedItems.length}
          </Typography>
          <Button
            variant="outlined"
            onClick={handleSelectAllItems}
            size={isMobile ? "large" : "medium"}
            sx={{ mr: 1 }}
          >
            Выбрать все
          </Button>
          <Button
            variant="contained"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={handleDeleteSelected}
            disabled={deleteManyMutation.isPending}
            size={isMobile ? "large" : "medium"}
          >
            {deleteManyMutation.isPending ? 'Удаление...' : 'Удалить выбранные'}
          </Button>
        </Toolbar>
      )}

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
              <TableCell padding="checkbox">
                <Checkbox
                  indeterminate={selectedItems.length > 0 && selectedItems.length < filteredItems.length}
                  checked={filteredItems.length > 0 && selectedItems.length === filteredItems.length}
                  onChange={handleSelectAll}
                />
              </TableCell>
              <TableCell>Наименование</TableCell>
              <TableCell align="right">Кол-во</TableCell>
              <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Артикул</TableCell>
              <TableCell align="right" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Цена</TableCell>
              <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Категория</TableCell>
              <TableCell align="center" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                Действия
              </TableCell>
              <TableCell sx={{ display: { xs: 'table-cell', sm: 'none' } }}>Действия</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <>
                {Array.from({ length: itemsPerPage }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell colSpan={isMobile ? 4 : 7}>
                      <SkeletonLoader variant="text" rows={1} />
                    </TableCell>
                  </TableRow>
                ))}
              </>
            ) : filteredItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isMobile ? 4 : 7} align="center">
                  <Typography color="text.secondary">
                    Товары не найдены
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredItems.map((item: WarehouseItem) => {
                const isSelected = selectedItems.includes(item._id);
                return (
                <TableRow 
                  key={item._id} 
                  hover 
                  selected={isSelected}
                  sx={{
                    backgroundColor: isSelected ? 'action.selected' : 'inherit',
                    '&:hover': {
                      backgroundColor: isSelected ? 'action.selected' : 'action.hover'
                    }
                  }}
                >
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={isSelected}
                      onChange={() => handleSelectItem(item._id)}
                    />
                  </TableCell>
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
                          {item.category && ` | Категория: ${item.category}`}
                        </Typography>
                      </Box>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                      {(() => {
                        // Явно преобразуем в число для отображения
                        let quantity: number | string = '-';
                        if (item.quantity !== undefined && item.quantity !== null) {
                          const numQuantity = typeof item.quantity === 'string' 
                            ? parseFloat(item.quantity) 
                            : Number(item.quantity);
                          quantity = isNaN(numQuantity) ? 0 : numQuantity;
                        }
                        
                        // ВАЖНО: Явно преобразуем в строку для отображения, чтобы избежать любых неявных преобразований
                        // НЕ используем toLocaleString, так как это может добавить нули
                        const displayValue = quantity === '-' ? '-' : String(quantity);
                        
                        // Используем Typography для явного отображения, чтобы избежать любых неявных преобразований
                        return (
                          <Typography component="span" variant="body2">
                            {displayValue}
                          </Typography>
                        );
                      })()}
                      {item.lowStockThreshold !== undefined && item.lowStockThreshold !== null && item.lowStockThreshold !== 0 && item.quantity !== undefined && item.quantity <= item.lowStockThreshold && (
                        <WarningIcon sx={{ fontSize: 16, color: 'warning.main' }} />
                      )}
                    </Box>
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
                  <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                    {item.category || '-'}
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
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      {totalPages > 1 && (
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          gap: 2, 
          mt: 3, 
          flexWrap: 'wrap' 
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Показано {(page - 1) * itemsPerPage + 1}-{Math.min(page * itemsPerPage, totalItems)} из {totalItems}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <Select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setPage(1);
                }}
              >
                <MenuItem value={25}>25</MenuItem>
                <MenuItem value={50}>50</MenuItem>
                <MenuItem value={100}>100</MenuItem>
                <MenuItem value={200}>200</MenuItem>
              </Select>
            </FormControl>
            <Pagination
              count={totalPages}
              page={page}
              onChange={(_event, value) => setPage(value)}
              color="primary"
              size={isMobile ? "small" : "medium"}
              showFirstButton
              showLastButton
            />
          </Box>
        </Box>
      )}

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <form onSubmit={handleCreateSubmit(handleCreate)}>
          <DialogTitle>Добавить товар</DialogTitle>
          <DialogContent>
            <Controller
              name="name"
              control={createControl}
              render={({ field }: { field: any }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="Наименование *"
                  margin="normal"
                  required
                  error={!!createErrors.name}
                  helperText={createErrors.name?.message}
                  InputProps={{
                    style: { textTransform: 'none' }
                  }}
                  inputProps={{
                    style: { textTransform: 'none' }
                  }}
                />
              )}
            />
            <Controller
              name="quantity"
              control={createControl}
              render={({ field }: { field: any }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="Кол-во"
                  type="number"
                  margin="normal"
                  value={field.value ?? ''}
                  onChange={(e) => {
                    const value = e.target.value === '' ? null : parseFloat(e.target.value);
                    field.onChange(value);
                  }}
                  error={!!createErrors.quantity}
                  helperText={createErrors.quantity?.message}
                  InputProps={{
                    style: { textTransform: 'none' }
                  }}
                  inputProps={{
                    style: { textTransform: 'none' }
                  }}
                />
              )}
            />
            <Controller
              name="article"
              control={createControl}
              render={({ field }: { field: any }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="Артикул"
                  margin="normal"
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value || null)}
                  error={!!createErrors.article}
                  helperText={createErrors.article?.message}
                  InputProps={{
                    style: { textTransform: 'none' }
                  }}
                  inputProps={{
                    style: { textTransform: 'none' }
                  }}
                />
              )}
            />
            <Controller
              name="price"
              control={createControl}
              render={({ field }: { field: any }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="Цена"
                  type="number"
                  margin="normal"
                  value={field.value ?? ''}
                  onChange={(e) => {
                    const value = e.target.value === '' ? null : parseFloat(e.target.value);
                    field.onChange(value);
                  }}
                  error={!!createErrors.price}
                  helperText={createErrors.price?.message}
                  InputProps={{
                    style: { textTransform: 'none' }
                  }}
                  inputProps={{
                    style: { textTransform: 'none' }
                  }}
                />
              )}
            />
            <Controller
              name="category"
              control={createControl}
              render={({ field }: { field: any }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="Категория"
                  margin="normal"
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value || null)}
                  error={!!createErrors.category}
                  helperText={createErrors.category?.message}
                  InputProps={{
                    style: { textTransform: 'none' }
                  }}
                  inputProps={{
                    style: { textTransform: 'none' }
                  }}
                />
              )}
            />
            <Controller
              name="lowStockThreshold"
              control={createControl}
              render={({ field }: { field: any }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="Порог остатка (уведомление)"
                  type="number"
                  margin="normal"
                  value={field.value ?? ''}
                  onChange={(e) => {
                    const value = e.target.value === '' ? null : parseFloat(e.target.value);
                    field.onChange(value);
                  }}
                  error={!!createErrors.lowStockThreshold}
                  helperText={createErrors.lowStockThreshold?.message || 'Уведомление при достижении этого количества'}
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
            <Button onClick={handleCloseDialog} disabled={createMutation.isPending} size={isMobile ? "large" : "medium"}>
              Отмена
            </Button>
            <Button type="submit" variant="contained" disabled={createMutation.isPending} size={isMobile ? "large" : "medium"}>
              {createMutation.isPending ? <CircularProgress size={24} /> : 'Добавить'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onClose={handleCloseEditDialog} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <form onSubmit={handleEditSubmit(handleUpdate)}>
          <DialogTitle>Редактировать товар</DialogTitle>
          <DialogContent>
            <Controller
              name="name"
              control={editControl}
              render={({ field }: { field: any }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="Наименование *"
                  margin="normal"
                  required
                  error={!!editErrors.name}
                  helperText={editErrors.name?.message}
                  InputProps={{
                    style: { textTransform: 'none' }
                  }}
                  inputProps={{
                    style: { textTransform: 'none' }
                  }}
                />
              )}
            />
            <Controller
              name="quantity"
              control={editControl}
              render={({ field }: { field: any }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="Кол-во"
                  type="number"
                  margin="normal"
                  value={field.value ?? ''}
                  onChange={(e) => {
                    const value = e.target.value === '' ? null : parseFloat(e.target.value);
                    field.onChange(value);
                  }}
                  error={!!editErrors.quantity}
                  helperText={editErrors.quantity?.message}
                  InputProps={{
                    style: { textTransform: 'none' }
                  }}
                  inputProps={{
                    style: { textTransform: 'none' }
                  }}
                />
              )}
            />
            <Controller
              name="article"
              control={editControl}
              render={({ field }: { field: any }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="Артикул"
                  margin="normal"
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value || null)}
                  error={!!editErrors.article}
                  helperText={editErrors.article?.message}
                  InputProps={{
                    style: { textTransform: 'none' }
                  }}
                  inputProps={{
                    style: { textTransform: 'none' }
                  }}
                />
              )}
            />
            <Controller
              name="price"
              control={editControl}
              render={({ field }: { field: any }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="Цена"
                  type="number"
                  margin="normal"
                  value={field.value ?? ''}
                  onChange={(e) => {
                    const value = e.target.value === '' ? null : parseFloat(e.target.value);
                    field.onChange(value);
                  }}
                  error={!!editErrors.price}
                  helperText={editErrors.price?.message}
                  InputProps={{
                    style: { textTransform: 'none' }
                  }}
                  inputProps={{
                    style: { textTransform: 'none' }
                  }}
                />
              )}
            />
            <Controller
              name="category"
              control={editControl}
              render={({ field }: { field: any }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="Категория"
                  margin="normal"
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value || null)}
                  error={!!editErrors.category}
                  helperText={editErrors.category?.message}
                  InputProps={{
                    style: { textTransform: 'none' }
                  }}
                  inputProps={{
                    style: { textTransform: 'none' }
                  }}
                />
              )}
            />
            <Controller
              name="lowStockThreshold"
              control={editControl}
              render={({ field }: { field: any }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="Порог остатка (уведомление)"
                  type="number"
                  margin="normal"
                  value={field.value ?? ''}
                  onChange={(e) => {
                    const value = e.target.value === '' ? null : parseFloat(e.target.value);
                    field.onChange(value);
                  }}
                  error={!!editErrors.lowStockThreshold}
                  helperText={editErrors.lowStockThreshold?.message || 'Уведомление при достижении этого количества'}
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
            <Button onClick={handleCloseEditDialog} disabled={updateMutation.isPending} size={isMobile ? "large" : "medium"}>
              Отмена
            </Button>
            <Button type="submit" variant="contained" disabled={updateMutation.isPending} size={isMobile ? "large" : "medium"}>
              {updateMutation.isPending ? <CircularProgress size={24} /> : 'Сохранить'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onClose={() => setImportDialogOpen(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle>Импорт товаров из Excel</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Формат Excel файла (колонки определяются автоматически по заголовкам или содержимому):
            <br />Наименование - текстовая колонка с названиями товаров
            <br />Артикул - колонка с артикулами товаров
            <br />Количество - числовая колонка с количеством (сколько добавить/вычесть/заменить)
            <br />Цена - числовая колонка с ценой (опционально)
            <br />
            <br />
            <strong>Примеры форматов:</strong>
            <br />A - Наименование, B - Кол-во, C - Артикул, D - Цена
            <br />или A - Артикул, B - (пусто), C - Наименование, D - Кол-во
            <br />
            <br />
            <strong>Режим "Удалить товары по артикулу":</strong>
            <br />Удаляет товары, у которых артикул совпадает с артикулами из Excel.
            <br />В этом режиме важна только колонка с артикулами.
          </Typography>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Режим импорта</InputLabel>
            <Select
              value={importMode}
              label="Режим импорта"
              onChange={(e) => setImportMode(e.target.value as 'add' | 'replace' | 'remove' | 'delete')}
            >
              <MenuItem value="add">Добавить количество (суммировать)</MenuItem>
              <MenuItem value="replace">Заменить количество</MenuItem>
              <MenuItem value="remove">Уменьшить количество (удалить при 0)</MenuItem>
              <MenuItem value="delete">Удалить товары по артикулу</MenuItem>
            </Select>
          </FormControl>
          {importMode === 'remove' && (
            <Typography variant="body2" color="info.main" sx={{ mb: 2, fontStyle: 'italic' }}>
              <strong>Режим "Уменьшить количество":</strong>
              <br />Число в колонке "Количество" указывает, сколько нужно убрать с текущего количества товара.
              <br />Если количество становится 0, товар автоматически удаляется со склада.
              <br />Если товар встречается несколько раз в файле, количества суммируются.
            </Typography>
          )}
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

