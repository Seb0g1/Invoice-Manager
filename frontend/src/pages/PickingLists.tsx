import React, { useState, useEffect, Fragment } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  TextField,
  MenuItem,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  CircularProgress,
  useMediaQuery,
  InputAdornment,
  Autocomplete,
  FormControl,
  InputLabel,
  Select
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  UploadFile as UploadFileIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  FileDownload as FileDownloadIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ru } from 'date-fns/locale';
import { format } from 'date-fns';
import api from '../services/api';
import { PickingList, PickingListItem, Supplier, WarehouseItem } from '../types';
import { useThemeContext } from '../contexts/ThemeContext';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import toast from 'react-hot-toast';
import { handleError } from '../utils/errorHandler';
import SkeletonLoader from '../components/SkeletonLoader';
import { useDebounce } from '../utils/debounce';

const PickingLists: React.FC = () => {
  const { theme, mode } = useThemeContext();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [pickingLists, setPickingLists] = useState<PickingList[]>([]);
  const [selectedList, setSelectedList] = useState<PickingList | null>(null);
  const [items, setItems] = useState<PickingListItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [addItemDialogOpen, setAddItemDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PickingListItem | null>(null);
  const [newListDate, setNewListDate] = useState<Date | null>(new Date());
  const [newListName, setNewListName] = useState<string>('');
  const [createGoogleSheet, setCreateGoogleSheet] = useState<boolean>(false);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<'add' | 'replace' | 'remove' | 'delete'>('add');
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [filterDate, setFilterDate] = useState<string>('');
  const [filterSupplier, setFilterSupplier] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [deleteItemModalOpen, setDeleteItemModalOpen] = useState(false);
  const [deleteListModalOpen, setDeleteListModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<PickingListItem | null>(null);
  const [listToDelete, setListToDelete] = useState<PickingList | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchPickingLists();
    fetchSuppliers();
  }, []);

  useEffect(() => {
    if (selectedList) {
      fetchItems(selectedList._id);
    }
  }, [selectedList]);

  const fetchPickingLists = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filterDate) {
        params.startDate = filterDate;
        params.endDate = filterDate;
      }
      const response = await api.get('/picking-lists', { params });
      setPickingLists(response.data);
      if (response.data.length > 0 && !selectedList) {
        setSelectedList(response.data[0]);
      }
    } catch (error) {
      handleError(error, 'Ошибка при загрузке листов сборки');
    } finally {
      setLoading(false);
    }
  };

  const fetchItems = async (listId: string) => {
    try {
      setItemsLoading(true);
      const response = await api.get(`/picking-lists/${listId}`);
      setItems(response.data.items || []);
    } catch (error) {
      handleError(error, 'Ошибка при загрузке элементов');
    } finally {
      setItemsLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const response = await api.get('/suppliers');
      setSuppliers(response.data);
    } catch (error) {
      // Игнорируем ошибку, если нет доступа
    }
  };

  const handleCreateList = async (shouldImport: boolean = false) => {
    try {
      if (createGoogleSheet && !newListName.trim()) {
        toast.error('Введите название для Google таблицы');
        return;
      }

      const response = await api.post('/picking-lists', {
        date: newListDate?.toISOString() || new Date().toISOString(),
        name: newListName.trim() || undefined,
        createGoogleSheet: createGoogleSheet
      });
      
      toast.success('Лист сборки создан');
      
      // Если создана Google таблица, открываем её
      if (response.data.googleSheetUrl) {
        toast.success('Google таблица создана! Переход...', { duration: 3000 });
        setTimeout(() => {
          window.open(response.data.googleSheetUrl, '_blank');
        }, 500);
      }
      
      const createdList = response.data;
      await fetchPickingLists();
      setSelectedList(createdList);
      
      // Если выбран файл Excel и нужно импортировать, импортируем его сразу после создания листа
      if (shouldImport && excelFile && createdList) {
        setImporting(true);
        try {
          const formData = new FormData();
          formData.append('file', excelFile);
          formData.append('pickingListId', createdList._id);
          formData.append('mode', importMode);

          const importResponse = await api.post('/picking-lists/import', formData, {
            headers: {
              'Content-Type': 'multipart/form-data'
            }
          });

          const message = importResponse.data.message || 'Операция завершена успешно';
          toast.success(message);
          setExcelFile(null);
          await fetchItems(createdList._id);
        } catch (error: any) {
          console.error('Ошибка импорта Excel:', error);
          const errorMessage = error.response?.data?.message || error.message || 'Ошибка при импорте Excel';
          toast.error(errorMessage);
          handleError(error, 'Ошибка при импорте Excel');
        } finally {
          setImporting(false);
        }
      }
      
      setCreateDialogOpen(false);
      setNewListDate(new Date());
      setNewListName('');
      setCreateGoogleSheet(false);
    } catch (error) {
      handleError(error, 'Ошибка при создании листа');
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setExcelFile(file);
    }
    // Сброс input
    e.target.value = '';
  };

  const handleImportExcel = async () => {
    if (!excelFile || !selectedList) {
      toast.error('Выберите файл и лист сборки');
      return;
    }

    console.log('[Frontend Import] Начало импорта:', {
      fileName: excelFile.name,
      fileSize: excelFile.size,
      pickingListId: selectedList._id,
      mode: importMode
    });

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', excelFile);
      formData.append('pickingListId', selectedList._id);
      formData.append('mode', importMode);
      
      console.log('[Frontend Import] FormData создан, отправка запроса...');

      const response = await api.post('/picking-lists/import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      const message = response.data.message || 'Операция завершена успешно';
      toast.success(message);
      setImportDialogOpen(false);
      setExcelFile(null);
      await fetchItems(selectedList._id);
    } catch (error: any) {
      console.error('Ошибка импорта Excel:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Ошибка при импорте Excel';
      toast.error(errorMessage);
      handleError(error, 'Ошибка при импорте Excel');
    } finally {
      setImporting(false);
    }
  };

  const handleExport = async () => {
    if (!selectedList) {
      toast.error('Выберите лист сборки');
      return;
    }

    setExporting(true);
    try {
      const response = await api.get(`/picking-lists/${selectedList._id}/export`, {
        responseType: 'blob'
      });

      // Создаем ссылку для скачивания
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const listName = selectedList.name || format(new Date(selectedList.date), 'dd.MM.yyyy', { locale: ru });
      const filename = `picking-list-${listName}-${new Date().toISOString().split('T')[0]}.xlsx`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('Экспорт завершен успешно');
    } catch (error) {
      handleError(error, 'Ошибка при экспорте листа сборки');
    } finally {
      setExporting(false);
    }
  };

  const handleToggleCollected = async (item: PickingListItem) => {
    try {
      await api.put(`/picking-list-items/${item._id}`, {
        collected: !item.collected
      });
      await fetchItems(selectedList!._id);
    } catch (error) {
      handleError(error, 'Ошибка при обновлении статуса');
    }
  };

  const handleTogglePaid = async (item: PickingListItem) => {
    try {
      await api.put(`/picking-list-items/${item._id}`, {
        paid: !item.paid
      });
      await fetchItems(selectedList!._id);
    } catch (error) {
      handleError(error, 'Ошибка при обновлении статуса');
    }
  };

  const handleEdit = (item: PickingListItem) => {
    setEditingItem(item);
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async (formData: any) => {
    if (!editingItem) return;

    try {
      await api.put(`/picking-list-items/${editingItem._id}`, formData);
      toast.success('Элемент обновлён');
      setEditDialogOpen(false);
      setEditingItem(null);
      await fetchItems(selectedList!._id);
    } catch (error) {
      handleError(error, 'Ошибка при обновлении');
    }
  };

  const handleAddItem = async (formData: any) => {
    if (!selectedList) {
      toast.error('Выберите лист сборки');
      return;
    }

    try {
      await api.post('/picking-list-items', {
        pickingListId: selectedList._id,
        name: formData.name,
        article: formData.article,
        quantity: formData.quantity,
        price: formData.price,
        supplierId: formData.supplierId || undefined
      });
      toast.success('Товар добавлен');
      setAddItemDialogOpen(false);
      await fetchItems(selectedList._id);
    } catch (error) {
      handleError(error, 'Ошибка при добавлении товара');
    }
  };

  const handleDelete = (item: PickingListItem) => {
    setItemToDelete(item);
    setDeleteItemModalOpen(true);
  };

  const handleDeleteConfirm = async (confirmValue?: string) => {
    if (!itemToDelete || !selectedList) return;

    // Проверка подтверждения через модальное окно
    if (confirmValue !== undefined && confirmValue !== itemToDelete.name) {
      toast.error('Название товара не совпадает');
      return;
    }

    try {
      setDeleting(true);
      await api.delete(`/picking-list-items/${itemToDelete._id}`);
      toast.success('Элемент удалён');
      setDeleteItemModalOpen(false);
      setItemToDelete(null);
      await fetchItems(selectedList._id);
    } catch (error) {
      handleError(error, 'Ошибка при удалении');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteList = (list: PickingList) => {
    setListToDelete(list);
    setDeleteListModalOpen(true);
  };

  const handleDeleteListConfirm = async () => {
    if (!listToDelete) return;

    try {
      setDeleting(true);
      await api.delete(`/picking-lists/${listToDelete._id}`);
      toast.success('Лист сборки удалён');
      setDeleteListModalOpen(false);
      setListToDelete(null);
      if (selectedList?._id === listToDelete._id) {
        setSelectedList(null);
        setItems([]);
      }
      await fetchPickingLists();
    } catch (error) {
      handleError(error, 'Ошибка при удалении');
    } finally {
      setDeleting(false);
    }
  };

  // Фильтрация элементов
  const filteredItems = items.filter(item => {
    // Фильтр по поиску
    if (debouncedSearchTerm) {
      const searchLower = debouncedSearchTerm.toLowerCase();
      const nameMatch = item.name?.toLowerCase().includes(searchLower);
      const articleMatch = item.article?.toLowerCase().includes(searchLower);
      if (!nameMatch && !articleMatch) {
        return false;
      }
    }
    
    // Фильтр по поставщику
    if (filterSupplier) {
      const itemSupplierId = item.supplier && typeof item.supplier === 'object' 
        ? item.supplier._id 
        : item.supplier || 'no-supplier';
      if (itemSupplierId !== filterSupplier) {
        return false;
      }
    }

    // Поиск по наименованию или артикулу
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const nameMatch = item.name.toLowerCase().includes(searchLower);
      const articleMatch = item.article?.toLowerCase().includes(searchLower);
      if (!nameMatch && !articleMatch) {
        return false;
      }
    }

    return true;
  });

  const collectedCount = items.filter(item => item.collected).length;
  const totalCount = items.length;
  const filteredTotalCount = filteredItems.length;

  // Пересчет группировки с учетом фильтров
  const filteredGroupedBySupplier = filteredItems.reduce((acc, item) => {
    const supplierId = item.supplier && typeof item.supplier === 'object' 
      ? item.supplier._id 
      : item.supplier || 'no-supplier';
    const supplierName = item.supplier && typeof item.supplier === 'object' 
      ? item.supplier.name 
      : 'Без поставщика';

    if (!acc[supplierId]) {
      acc[supplierId] = {
        supplier: item.supplier && typeof item.supplier === 'object' ? item.supplier : null,
        supplierName,
        items: [],
        totalAmount: 0,
        collectedCount: 0,
        totalCount: 0
      };
    }

    acc[supplierId].items.push(item);
    acc[supplierId].totalAmount += (item.price || 0) * item.quantity;
    acc[supplierId].totalCount += item.quantity;
    if (item.collected) {
      acc[supplierId].collectedCount += item.quantity;
    }

    return acc;
  }, {} as Record<string, {
    supplier: Supplier | null;
    supplierName: string;
    items: PickingListItem[];
    totalAmount: number;
    collectedCount: number;
    totalCount: number;
  }>);

  const filteredSupplierGroups = Object.values(filteredGroupedBySupplier).sort((a, b) => 
    a.supplierName.localeCompare(b.supplierName)
  );

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
          Листы сборки
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
            size={isMobile ? "large" : "medium"}
          >
            Создать лист
          </Button>
          {selectedList && (
            <Button
              variant="outlined"
              startIcon={<UploadFileIcon />}
              onClick={() => setImportDialogOpen(true)}
              size={isMobile ? "large" : "medium"}
            >
              Импорт Excel
            </Button>
          )}
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexDirection: { xs: 'column', md: 'row' } }}>
        <Paper sx={{ p: 2, flex: { xs: '1 1 100%', md: '0 0 300px' } }}>
          <Typography variant="h6" gutterBottom sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
            Листы сборки
          </Typography>
          <TextField
            type="date"
            label="Фильтр по дате"
            value={filterDate}
            onChange={(e) => {
              setFilterDate(e.target.value);
              fetchPickingLists();
            }}
            InputLabelProps={{ shrink: true }}
            fullWidth
            size="small"
            sx={{ mb: 2 }}
          />
          {loading ? (
            <SkeletonLoader variant="list" rows={5} />
          ) : pickingLists.length === 0 ? (
            <Typography color="text.secondary">Нет листов сборки</Typography>
          ) : (
            <Box sx={{ maxHeight: '400px', overflowY: 'auto' }}>
              {pickingLists.map((list) => (
                <Box
                  key={list._id}
                  onClick={() => setSelectedList(list)}
                  sx={{
                    p: 1.5,
                    mb: 1,
                    cursor: 'pointer',
                    borderRadius: 2,
                    bgcolor: selectedList?._id === list._id
                      ? mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'
                      : 'transparent',
                    '&:hover': {
                      bgcolor: mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)'
                    },
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {format(new Date(list.date), 'dd.MM.yyyy', { locale: ru })}
                    </Typography>
                  </Box>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteList(list);
                    }}
                    sx={{ minWidth: { xs: 44, sm: 'auto' }, minHeight: { xs: 44, sm: 'auto' } }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
            </Box>
          )}
        </Paper>

        <Paper sx={{ p: { xs: 1.5, sm: 2 }, flex: 1 }}>
          {selectedList ? (
            <>
              <Box sx={{ 
                display: 'flex', 
                flexDirection: { xs: 'column', sm: 'row' },
                justifyContent: 'space-between', 
                alignItems: { xs: 'flex-start', sm: 'center' }, 
                mb: 2, 
                flexWrap: 'wrap', 
                gap: 1 
              }}>
                <Box>
                  <Typography variant="h6" sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                    {selectedList.name || format(new Date(selectedList.date), 'dd.MM.yyyy', { locale: ru })}
                  </Typography>
                  {selectedList.googleSheetUrl && (
                    <Button
                      variant="outlined"
                      size="small"
                      href={selectedList.googleSheetUrl}
                      target="_blank"
                      sx={{ mt: 0.5 }}
                    >
                      Открыть Google таблицу
                    </Button>
                  )}
                </Box>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => setAddItemDialogOpen(true)}
                    size={isMobile ? "small" : "medium"}
                    sx={{ minHeight: { xs: 36, sm: 'auto' } }}
                  >
                    Добавить товар
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<UploadFileIcon />}
                    onClick={() => setImportDialogOpen(true)}
                    size={isMobile ? "small" : "medium"}
                    sx={{ minHeight: { xs: 36, sm: 'auto' } }}
                  >
                    Импорт Excel
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<FileDownloadIcon />}
                    onClick={handleExport}
                    disabled={exporting || items.length === 0}
                    size={isMobile ? "small" : "medium"}
                    sx={{ minHeight: { xs: 36, sm: 'auto' } }}
                  >
                    {exporting ? 'Экспорт...' : 'Экспорт Excel'}
                  </Button>
                  <Chip
                    label={`Собрано: ${collectedCount}/${totalCount}`}
                    color={collectedCount === totalCount && totalCount > 0 ? 'success' : 'default'}
                    size={isMobile ? "small" : "medium"}
                  />
                  {(filterSupplier || searchTerm) && (
                    <Chip
                      label={`Найдено: ${filteredTotalCount}`}
                      variant="outlined"
                      size="small"
                    />
                  )}
                </Box>
              </Box>

              {/* Фильтры */}
              <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                <TextField
                  select
                  label="Поставщик"
                  value={filterSupplier}
                  onChange={(e) => setFilterSupplier(e.target.value)}
                  sx={{ minWidth: { xs: '100%', sm: 200 }, flex: { xs: '1 1 100%', sm: '0 1 auto' } }}
                  size="small"
                  fullWidth={isMobile}
                >
                  <MenuItem value="">Все поставщики</MenuItem>
                  {suppliers.map((supplier) => (
                    <MenuItem key={supplier._id} value={supplier._id}>
                      {supplier.name}
                    </MenuItem>
                  ))}
                  <MenuItem value="no-supplier">Без поставщика</MenuItem>
                </TextField>
                <TextField
                  label="Поиск товара"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Наименование или артикул..."
                  sx={{ flex: { xs: '1 1 100%', sm: '1 1 auto' }, minWidth: { xs: '100%', sm: 250 } }}
                  size="small"
                  fullWidth={isMobile}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" color="action" />
                      </InputAdornment>
                    ),
                    endAdornment: searchTerm ? (
                      <InputAdornment position="end">
                        <IconButton
                          size="small"
                          onClick={() => setSearchTerm('')}
                          edge="end"
                        >
                          <ClearIcon fontSize="small" />
                        </IconButton>
                      </InputAdornment>
                    ) : undefined,
                  }}
                />
                {(filterSupplier || searchTerm) && (
                  <Button
                    variant="outlined"
                    size={isMobile ? "medium" : "small"}
                    onClick={() => {
                      setFilterSupplier('');
                      setSearchTerm('');
                    }}
                    sx={{ 
                      alignSelf: 'flex-start',
                      width: { xs: '100%', sm: 'auto' },
                      minHeight: { xs: 44, sm: 'auto' }
                    }}
                    fullWidth={isMobile}
                  >
                    Сбросить
                  </Button>
                )}
              </Box>

              {itemsLoading ? (
                <SkeletonLoader variant="table" rows={5} columns={6} />
              ) : (
                <TableContainer sx={{ 
                  maxHeight: { xs: '400px', sm: '600px' }, 
                  overflowY: 'auto',
                  overflowX: 'auto'
                }}>
                  <Table size={isMobile ? "small" : "medium"}>
                    <TableHead>
                      <TableRow>
                        <TableCell padding="checkbox">Собран</TableCell>
                        <TableCell>Наименование</TableCell>
                        <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Артикул</TableCell>
                        <TableCell align="right">Кол-во</TableCell>
                        <TableCell align="right" sx={{ display: { xs: 'none', md: 'table-cell' } }}>Цена</TableCell>
                        <TableCell padding="checkbox">Оплачено</TableCell>
                        <TableCell align="center">Действия</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {items.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={isMobile ? 5 : 7} align="center">
                            <Typography color="text.secondary">
                              Нет элементов. Импортируйте Excel файл.
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ) : filteredItems.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={isMobile ? 5 : 7} align="center">
                            <Typography color="text.secondary">
                              Нет элементов, соответствующих фильтрам.
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ) : filteredSupplierGroups.length === 0 ? (
                        filteredItems.map((item) => (
                          <TableRow key={item._id} hover>
                            <TableCell padding="checkbox">
                              <Checkbox
                                checked={item.collected}
                                onChange={() => handleToggleCollected(item)}
                                icon={<CancelIcon />}
                                checkedIcon={<CheckCircleIcon color="success" />}
                              />
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {item.name}
                              </Typography>
                              {item.article && (
                                <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'block', sm: 'none' } }}>
                                  Арт: {item.article}
                                </Typography>
                              )}
                              {item.price && (
                                <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'block', md: 'none' }, mt: 0.5 }}>
                                  Цена: {item.price.toFixed(2)} ₽
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                              {item.article || '—'}
                            </TableCell>
                            <TableCell align="right">{item.quantity}</TableCell>
                            <TableCell align="right" sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                              {item.price ? `${item.price.toFixed(2)} ₽` : '—'}
                            </TableCell>
                            <TableCell padding="checkbox">
                              <Checkbox
                                checked={item.paid}
                                onChange={() => handleTogglePaid(item)}
                              />
                            </TableCell>
                            <TableCell align="center">
                              <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                                <IconButton
                                  size={isMobile ? "medium" : "small"}
                                  onClick={() => handleEdit(item)}
                                  sx={{ minWidth: { xs: 44, sm: 'auto' }, minHeight: { xs: 44, sm: 'auto' } }}
                                >
                                  <EditIcon fontSize={isMobile ? "medium" : "small"} />
                                </IconButton>
                                    <IconButton
                                      size={isMobile ? "medium" : "small"}
                                      color="error"
                                      onClick={() => handleDelete(item)}
                                      sx={{ minWidth: { xs: 44, sm: 'auto' }, minHeight: { xs: 44, sm: 'auto' } }}
                                    >
                                      <DeleteIcon fontSize={isMobile ? "medium" : "small"} />
                                    </IconButton>
                              </Box>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        filteredSupplierGroups.map((group, groupIndex) => (
                          <Fragment key={group.supplier?._id || `no-supplier-${groupIndex}`}>
                            {/* Заголовок группы поставщика */}
                            <TableRow
                              sx={{
                                bgcolor: mode === 'dark' 
                                  ? 'rgba(100, 181, 246, 0.1)' 
                                  : 'rgba(25, 118, 210, 0.08)',
                                '& td': {
                                  borderBottom: '2px solid',
                                  borderColor: mode === 'dark' 
                                    ? 'rgba(255, 255, 255, 0.1)' 
                                    : 'rgba(0, 0, 0, 0.1)',
                                  fontWeight: 600,
                                  py: 1.5
                                }
                              }}
                            >
                              <TableCell colSpan={isMobile ? 4 : 5}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                                    {group.supplierName}
                                  </Typography>
                                  <Chip
                                    label={`${group.collectedCount}/${group.totalCount} собран${group.totalCount > 1 ? 'о' : ''}`}
                                    size="small"
                                    color={group.collectedCount === group.totalCount && group.totalCount > 0 ? 'success' : 'default'}
                                  />
                                </Box>
                              </TableCell>
                              <TableCell align="right" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                                <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', md: 'block' } }}>
                                  Всего: {group.totalCount}
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 600, display: { xs: 'block', md: 'none' } }}>
                                  {group.totalCount} шт.
                                </Typography>
                              </TableCell>
                              <TableCell align="right" sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                                <Typography variant="body2" sx={{ fontWeight: 700, color: 'primary.main' }}>
                                  {group.totalAmount > 0 ? `${group.totalAmount.toFixed(2)} ₽` : '—'}
                                </Typography>
                              </TableCell>
                              <TableCell colSpan={isMobile ? 2 : 1}>
                                <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                                  <Typography variant="body2" sx={{ fontWeight: 700, color: 'error.main' }}>
                                    К оплате: {group.totalAmount.toFixed(2)} ₽
                                  </Typography>
                                </Box>
                              </TableCell>
                            </TableRow>
                            {/* Элементы группы */}
                            {group.items.map((item) => (
                              <TableRow key={item._id} hover>
                                <TableCell padding="checkbox">
                                  <Checkbox
                                    checked={item.collected}
                                    onChange={() => handleToggleCollected(item)}
                                    icon={<CancelIcon />}
                                    checkedIcon={<CheckCircleIcon color="success" />}
                                  />
                                </TableCell>
                                <TableCell>
                                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                    {item.name}
                                  </Typography>
                                  {item.article && (
                                    <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'block', sm: 'none' } }}>
                                      Арт: {item.article}
                                    </Typography>
                                  )}
                                  {item.price && (
                                    <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'block', md: 'none' }, mt: 0.5 }}>
                                      Цена: {item.price.toFixed(2)} ₽
                                    </Typography>
                                  )}
                                </TableCell>
                                <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                                  {item.article || '—'}
                                </TableCell>
                                <TableCell align="right">{item.quantity}</TableCell>
                                <TableCell align="right" sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                                  {item.price ? `${item.price.toFixed(2)} ₽` : '—'}
                                </TableCell>
                                <TableCell padding="checkbox">
                                  <Checkbox
                                    checked={item.paid}
                                    onChange={() => handleTogglePaid(item)}
                                  />
                                </TableCell>
                                <TableCell align="center">
                                  <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                                    <IconButton
                                      size={isMobile ? "medium" : "small"}
                                      onClick={() => handleEdit(item)}
                                      sx={{ minWidth: { xs: 44, sm: 'auto' }, minHeight: { xs: 44, sm: 'auto' } }}
                                    >
                                      <EditIcon fontSize={isMobile ? "medium" : "small"} />
                                    </IconButton>
                                    <IconButton
                                      size={isMobile ? "medium" : "small"}
                                      color="error"
                                      onClick={() => handleDelete(item)}
                                      sx={{ minWidth: { xs: 44, sm: 'auto' }, minHeight: { xs: 44, sm: 'auto' } }}
                                    >
                                      <DeleteIcon fontSize={isMobile ? "medium" : "small"} />
                                    </IconButton>
                                  </Box>
                                </TableCell>
                              </TableRow>
                            ))}
                          </Fragment>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </>
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography color="text.secondary">
                Выберите или создайте лист сборки
              </Typography>
            </Box>
          )}
        </Paper>
      </Box>

      {/* Диалог создания листа */}
      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>Создать лист сборки</DialogTitle>
        <DialogContent>
          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ru}>
            <DatePicker
              label="Дата листа сборки"
              value={newListDate}
              onChange={(newValue) => setNewListDate(newValue)}
              slotProps={{
                textField: {
                  fullWidth: true,
                  margin: 'normal',
                  required: true,
                  size: isMobile ? 'small' : 'medium'
                }
              }}
            />
          </LocalizationProvider>
          <Box sx={{ mt: 2, mb: 1 }}>
            <Checkbox
              checked={createGoogleSheet}
              onChange={(e) => setCreateGoogleSheet(e.target.checked)}
              size={isMobile ? 'small' : 'medium'}
            />
            <Typography component="span" variant="body2">
              Создать Google таблицу
            </Typography>
          </Box>
          {createGoogleSheet && (
            <TextField
              label="Название таблицы"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              fullWidth
              margin="normal"
              required={createGoogleSheet}
              size={isMobile ? 'small' : 'medium'}
              placeholder="Например: Лист сборки от 15.01.2024"
              helperText="Это название будет использовано для Google таблицы"
            />
          )}
          <Box sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle2" sx={{ mb: 2 }}>
              Импорт товаров из Excel
            </Typography>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleImport}
              style={{ display: 'none' }}
              id="excel-import-create-input"
              disabled={importing}
            />
            <label htmlFor="excel-import-create-input">
              <Button
                variant="outlined"
                component="span"
                startIcon={<UploadFileIcon />}
                fullWidth
                size="large"
                disabled={importing}
                sx={{ minHeight: 44, mb: 2 }}
              >
                {importing ? 'Импорт...' : 'Выбрать Excel файл'}
              </Button>
            </label>
            {excelFile && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Выбран файл: {excelFile.name}
              </Typography>
            )}
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
                <br />Если количество становится 0, товар автоматически удаляется из листа сборки.
                <br />Если товар встречается несколько раз в файле, количества суммируются.
              </Typography>
            )}
            {importMode === 'remove' && (
              <Typography variant="body2" color="info.main" sx={{ mb: 2, fontStyle: 'italic' }}>
                <strong>Режим "Уменьшить количество":</strong>
                <br />Число в колонке "Количество" указывает, сколько нужно убрать с текущего количества товара.
                <br />Если количество становится 0, товар автоматически удаляется из листа сборки.
                <br />Если товар встречается несколько раз в файле, количества суммируются.
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setCreateDialogOpen(false);
            setNewListName('');
            setCreateGoogleSheet(false);
            setExcelFile(null);
          }} size={isMobile ? "large" : "medium"}>
            Отмена
          </Button>
          {excelFile ? (
            <>
              <Button 
                onClick={() => handleCreateList(false)} 
                variant="outlined" 
                size={isMobile ? "large" : "medium"}
              >
                Создать
              </Button>
              <Button 
                onClick={async () => {
                  // Сначала создаем лист, затем импортируем
                  await handleCreateList(true);
                }} 
                variant="contained" 
                disabled={importing}
                size={isMobile ? "large" : "medium"}
                startIcon={importing ? <CircularProgress size={20} /> : <UploadFileIcon />}
              >
                {importing ? 'Импорт...' : 'Создать и импортировать'}
              </Button>
            </>
          ) : (
            <Button onClick={() => handleCreateList(false)} variant="contained" size={isMobile ? "large" : "medium"}>
              Создать
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Диалог импорта Excel */}
      <Dialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
      >
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
              Выбрать Excel файл
            </Button>
          </label>
          {excelFile && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2, mb: 1 }}>
              Выбран файл: {excelFile.name}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => {
              setImportDialogOpen(false);
              setExcelFile(null);
            }} 
            disabled={importing}
            size={isMobile ? "large" : "medium"}
          >
            Отмена
          </Button>
          <Button
            onClick={handleImportExcel}
            variant="contained"
            disabled={!excelFile || !selectedList || importing}
            size={isMobile ? "large" : "medium"}
            startIcon={importing ? <CircularProgress size={20} /> : <UploadFileIcon />}
          >
            {importing ? 'Импорт...' : 'Импортировать'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог добавления товара */}
      <AddItemDialog
        open={addItemDialogOpen}
        onClose={() => setAddItemDialogOpen(false)}
        onSave={handleAddItem}
        suppliers={suppliers}
        isMobile={isMobile}
      />

      {/* Диалог редактирования элемента */}
      {editingItem && (
        <EditItemDialog
          open={editDialogOpen}
          onClose={() => {
            setEditDialogOpen(false);
            setEditingItem(null);
          }}
          onSave={handleSaveEdit}
          item={editingItem}
          suppliers={suppliers}
          isMobile={isMobile}
        />
      )}

      {/* Модальное окно удаления товара */}
      {itemToDelete && (
        <DeleteConfirmModal
          open={deleteItemModalOpen}
          onClose={() => {
            setDeleteItemModalOpen(false);
            setItemToDelete(null);
          }}
          onConfirm={(confirmValue) => {
            if (itemToDelete && confirmValue === itemToDelete.name) {
              handleDeleteConfirm();
            }
          }}
          type="supplier"
          name={itemToDelete.name}
          confirmValue={itemToDelete.name}
          loading={deleting}
        />
      )}

      {/* Модальное окно удаления листа сборки */}
      {listToDelete && (
        <DeleteConfirmModal
          open={deleteListModalOpen}
          onClose={() => {
            setDeleteListModalOpen(false);
            setListToDelete(null);
          }}
          onConfirm={(confirmValue) => {
            if (listToDelete && confirmValue === format(new Date(listToDelete.date), 'dd.MM.yyyy')) {
              handleDeleteListConfirm();
            }
          }}
          type="invoice"
          name="лист сборки"
          confirmValue={format(new Date(listToDelete.date), 'dd.MM.yyyy')}
          loading={deleting}
        />
      )}
    </Box>
  );
};

interface AddItemDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  suppliers: Supplier[];
  isMobile: boolean;
}

const AddItemDialog: React.FC<AddItemDialogProps> = ({
  open,
  onClose,
  onSave,
  suppliers,
  isMobile
}) => {
  const [formData, setFormData] = useState({
    name: '',
    article: '',
    quantity: 1,
    price: 0,
    supplierId: ''
  });
  const [warehouseItems, setWarehouseItems] = useState<WarehouseItem[]>([]);
  const [warehouseSearchTerm, setWarehouseSearchTerm] = useState('');
  const [warehouseLoading, setWarehouseLoading] = useState(false);
  const [selectedWarehouseItem, setSelectedWarehouseItem] = useState<WarehouseItem | null>(null);

  // Загрузка товаров из склада при открытии диалога
  useEffect(() => {
    if (open) {
      fetchWarehouseItems();
    }
  }, [open]);

  // Поиск товаров из склада
  useEffect(() => {
    if (open && warehouseSearchTerm) {
      const timeoutId = setTimeout(() => {
        fetchWarehouseItems();
      }, 300);
      return () => clearTimeout(timeoutId);
    } else if (open && !warehouseSearchTerm) {
      fetchWarehouseItems();
    }
  }, [warehouseSearchTerm, open]);

  const fetchWarehouseItems = async () => {
    try {
      setWarehouseLoading(true);
      const response = await api.get('/warehouse', {
        params: warehouseSearchTerm ? { search: warehouseSearchTerm } : {}
      });
      setWarehouseItems(response.data);
    } catch (error) {
      console.error('Ошибка при загрузке товаров из склада:', error);
    } finally {
      setWarehouseLoading(false);
    }
  };

  const handleWarehouseItemSelect = (item: WarehouseItem | null) => {
    setSelectedWarehouseItem(item);
    if (item) {
      setFormData({
        ...formData,
        name: item.name,
        article: item.article || '',
        price: item.price || 0,
        quantity: 1
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    // Сброс формы
    setFormData({
      name: '',
      article: '',
      quantity: 1,
      price: 0,
      supplierId: ''
    });
  };

  const handleClose = () => {
    setFormData({
      name: '',
      article: '',
      quantity: 1,
      price: 0,
      supplierId: ''
    });
    setWarehouseSearchTerm('');
    setSelectedWarehouseItem(null);
    setWarehouseItems([]);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth fullScreen={isMobile}>
      <form onSubmit={handleSubmit}>
        <DialogTitle>Добавить товар</DialogTitle>
        <DialogContent>
          <Typography variant="subtitle2" sx={{ mb: 1, mt: 1, fontWeight: 600 }}>
            Поиск товара из склада
          </Typography>
          <Autocomplete
            fullWidth
            options={warehouseItems}
            getOptionLabel={(option) => `${option.name}${option.article ? ` (${option.article})` : ''}`}
            value={selectedWarehouseItem}
            onChange={(_, newValue) => handleWarehouseItemSelect(newValue)}
            onInputChange={(_, newInputValue) => setWarehouseSearchTerm(newInputValue)}
            loading={warehouseLoading}
            renderInput={(params) => {
              const { InputProps, inputProps, ...other } = params;
              return (
                <TextField
                  {...other}
                  label="Найти товар в складе"
                  margin="normal"
                  size={isMobile ? "small" : "medium"}
                  placeholder="Начните вводить название или артикул..."
                  InputProps={{
                    ...InputProps,
                    endAdornment: (
                      <>
                        {warehouseLoading ? <CircularProgress size={20} /> : null}
                        {InputProps.endAdornment}
                      </>
                    ),
                    style: { textTransform: 'none' }
                  }}
                  inputProps={{
                    ...inputProps,
                    style: { textTransform: 'none' }
                  }}
                />
              );
            }}
            filterOptions={(options, { inputValue }) => {
              if (!inputValue) return options;
              const searchLower = inputValue.toLowerCase();
              return options.filter((option) =>
                option.name.toLowerCase().includes(searchLower) ||
                option.article?.toLowerCase().includes(searchLower)
              );
            }}
            noOptionsText={warehouseSearchTerm ? "Товары не найдены" : "Начните вводить название или артикул"}
            isOptionEqualToValue={(option, value) => option._id === value._id}
            clearOnEscape
            clearText="Очистить"
            openOnFocus
          />
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, mt: 1 }}>
            Или заполните вручную:
          </Typography>
          <TextField
            fullWidth
            label="Наименование"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            margin="normal"
            required
            size={isMobile ? "small" : "medium"}
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
            size={isMobile ? "small" : "medium"}
            InputProps={{
              style: { textTransform: 'none' }
            }}
            inputProps={{
              style: { textTransform: 'none' }
            }}
          />
          <TextField
            fullWidth
            label="Количество"
            type="number"
            value={formData.quantity}
            onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
            margin="normal"
            required
            size={isMobile ? "small" : "medium"}
          />
          <TextField
            fullWidth
            label="Цена"
            type="number"
            value={formData.price}
            onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
            margin="normal"
            InputProps={{
              startAdornment: <InputAdornment position="start">₽</InputAdornment>
            }}
            size={isMobile ? "small" : "medium"}
          />
          <Autocomplete
            fullWidth
            options={suppliers}
            getOptionLabel={(option) => option.name}
            value={suppliers.find(s => s._id === formData.supplierId) || null}
            onChange={(_, newValue) => {
              setFormData({ ...formData, supplierId: newValue?._id || '' });
            }}
            renderInput={(params) => {
              const { InputProps, inputProps, ...other } = params;
              return (
                <TextField
                  {...other}
                  label="Поставщик"
                  margin="normal"
                  size={isMobile ? "small" : "medium"}
                  placeholder="Начните вводить название..."
                  InputProps={InputProps}
                  inputProps={inputProps}
                />
              );
            }}
            filterOptions={(options, { inputValue }) => {
              if (!inputValue) return options;
              return options.filter((option) =>
                option.name.toLowerCase().includes(inputValue.toLowerCase())
              );
            }}
            noOptionsText="Поставщики не найдены"
            isOptionEqualToValue={(option, value) => option._id === value._id}
            clearOnEscape
            clearText="Очистить"
            openOnFocus
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} size={isMobile ? "large" : "medium"}>
            Отмена
          </Button>
          <Button type="submit" variant="contained" size={isMobile ? "large" : "medium"}>
            Добавить
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

interface EditItemDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  item: PickingListItem;
  suppliers: Supplier[];
  isMobile: boolean;
}

const EditItemDialog: React.FC<EditItemDialogProps> = ({
  open,
  onClose,
  onSave,
  item,
  suppliers,
  isMobile
}) => {
  const [formData, setFormData] = useState({
    name: item.name,
    article: item.article,
    quantity: item.quantity,
    price: item.price || 0,
    supplierId: item.supplier && typeof item.supplier === 'object' ? item.supplier._id : item.supplier || ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth fullScreen={isMobile}>
      <form onSubmit={handleSubmit}>
        <DialogTitle>Редактировать элемент</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Наименование"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            margin="normal"
            required
            size={isMobile ? "small" : "medium"}
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
            size={isMobile ? "small" : "medium"}
            InputProps={{
              style: { textTransform: 'none' }
            }}
            inputProps={{
              style: { textTransform: 'none' }
            }}
          />
          <TextField
            fullWidth
            label="Количество"
            type="number"
            value={formData.quantity}
            onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
            margin="normal"
            required
            size={isMobile ? "small" : "medium"}
          />
          <TextField
            fullWidth
            label="Цена"
            type="number"
            value={formData.price}
            onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
            margin="normal"
            InputProps={{
              startAdornment: <InputAdornment position="start">₽</InputAdornment>
            }}
            size={isMobile ? "small" : "medium"}
          />
          <Autocomplete
            fullWidth
            options={suppliers}
            getOptionLabel={(option) => option.name}
            value={suppliers.find(s => s._id === formData.supplierId) || null}
            onChange={(_, newValue) => {
              setFormData({ ...formData, supplierId: newValue?._id || '' });
            }}
            renderInput={(params) => {
              const { InputProps, inputProps, ...other } = params;
              return (
                <TextField
                  {...other}
                  label="Поставщик"
                  margin="normal"
                  size={isMobile ? "small" : "medium"}
                  placeholder="Начните вводить название..."
                  InputProps={InputProps}
                  inputProps={inputProps}
                />
              );
            }}
            filterOptions={(options, { inputValue }) => {
              if (!inputValue) return options;
              return options.filter((option) =>
                option.name.toLowerCase().includes(inputValue.toLowerCase())
              );
            }}
            noOptionsText="Поставщики не найдены"
            isOptionEqualToValue={(option, value) => option._id === value._id}
            clearOnEscape
            clearText="Очистить"
            openOnFocus
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} size={isMobile ? "large" : "medium"}>
            Отмена
          </Button>
          <Button type="submit" variant="contained" size={isMobile ? "large" : "medium"}>
            Сохранить
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default PickingLists;

