import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  InputAdornment,
  IconButton,
  Chip,
  useMediaQuery,
  Button,
  Pagination,
  Grid,
  Card,
  CardContent,
  CardMedia,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Collapse,
  Skeleton,
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  Refresh as RefreshIcon,
  FilterList as FilterListIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  FileDownload as FileDownloadIcon,
} from '@mui/icons-material';
import api from '../services/api';
import { useThemeContext } from '../contexts/ThemeContext';
import toast from 'react-hot-toast';

interface BusinessLink {
  businessId: string;
  businessName: string;
  offerId: string;
  price: number;
  stock: {
    available: number;
    reserved?: number;
  };
  status?: string;
}

interface Product {
  id: string;
  vendorCode: string;
  name: string;
  description?: string;
  images: string[];
  category?: string;
  businesses: BusinessLink[];
}

// Функция для перевода статуса на русский
const translateStatus = (status?: string): string => {
  if (!status) return 'Неизвестно';
  
  const statusMap: Record<string, string> = {
    'PUBLISHED': 'Опубликован',
    'UNPUBLISHED': 'Не опубликован',
    'ACTIVE': 'Активен',
    'INACTIVE': 'Неактивен',
    'HAS_CARD_CAN_NOT_UPDATE': 'Карточка Маркета',
    'HAS_CARD_CAN_UPDATE': 'Можно дополнить',
    'HAS_CARD_CAN_UPDATE_ERRORS': 'Изменения не приняты',
    'HAS_CARD_CAN_UPDATE_PROCESSING': 'Изменения на проверке',
    'NO_CARD_NEED_CONTENT': 'Создайте карточку',
    'NO_CARD_MARKET_WILL_CREATE': 'Создаст Маркет',
    'NO_CARD_ERRORS': 'Не создана из-за ошибки',
    'NO_CARD_PROCESSING': 'Проверяем данные',
    'NO_CARD_ADD_TO_CAMPAIGN': 'Разместите товар в магазине',
  };
  
  return statusMap[status] || status;
};

// Функция для получения цвета статуса
const getStatusColor = (status?: string): "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning" => {
  if (!status) return 'default';
  
  if (status.includes('PUBLISHED') || status === 'ACTIVE' || status.includes('HAS_CARD')) {
    return 'success';
  }
  if (status.includes('ERROR') || status === 'INACTIVE') {
    return 'error';
  }
  if (status.includes('PROCESSING')) {
    return 'info';
  }
  if (status.includes('NO_CARD')) {
    return 'warning';
  }
  
  return 'default';
};

const YandexMarketProducts: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [businessFilter, setBusinessFilter] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<string>('all'); // all, in_stock, out_of_stock
  const [page, setPage] = useState(1);
  const [itemsPerPage] = useState(50);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [businesses, setBusinesses] = useState<Array<{ businessId: string; name: string }>>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [editingPrice, setEditingPrice] = useState<{ vendorCode: string; price: number } | null>(null);
  const [updatingPrice, setUpdatingPrice] = useState(false);
  const { theme } = useThemeContext();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  // Загружаем список бизнесов и категорий
  useEffect(() => {
    fetchBusinesses();
  }, []);

  const fetchBusinesses = async () => {
    try {
      const response = await api.get('/yandex-market-go/businesses');
      if (response.data) {
        // Обрабатываем разные форматы ответа
        let businessesList: Array<{ businessId: string; name: string }> = [];
        if (Array.isArray(response.data)) {
          // Если ответ - массив напрямую
          businessesList = response.data.map((b: any) => ({
            businessId: b.businessId || b._id || b.id,
            name: b.name || b.businessName || `Бизнес ${b.businessId || b._id || b.id}`
          }));
        } else if (response.data.businesses && Array.isArray(response.data.businesses)) {
          // Если ответ - объект с полем businesses
          businessesList = response.data.businesses.map((b: any) => ({
            businessId: b.businessId || b._id || b.id,
            name: b.name || b.businessName || `Бизнес ${b.businessId || b._id || b.id}`
          }));
        }
        setBusinesses(businessesList);
      }
    } catch (error: any) {
      console.error('Ошибка загрузки бизнесов:', error);
      toast.error(error.response?.data?.message || 'Ошибка загрузки списка бизнесов');
      setBusinesses([]); // Устанавливаем пустой массив при ошибке
    }
  };

  // Debouncing для поиска
  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      // Сбрасываем на первую страницу при изменении поиска
      if (page !== 1) {
        setPage(1);
      }
    }, 500); // 500ms задержка

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [searchTerm]);

  useEffect(() => {
    fetchProducts();
  }, [page, debouncedSearchTerm, statusFilter, categoryFilter, businessFilter, stockFilter]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await api.get('/yandex-market-go/products', {
        params: {
          page,
          limit: itemsPerPage,
          search: debouncedSearchTerm || undefined,
          businessId: businessFilter !== 'all' ? businessFilter : undefined,
        },
      });
      
      if (response.data) {
        setProducts(response.data.products || []);
        setTotal(response.data.pagination?.total || 0);
        setTotalPages(response.data.pagination?.totalPages || 1);
        
        // Собираем уникальные категории
        const uniqueCategories = new Set<string>();
        (response.data.products || []).forEach((p: Product) => {
          if (p.category) uniqueCategories.add(p.category);
        });
        setCategories(Array.from(uniqueCategories).sort());
      }
    } catch (error: any) {
      console.error('Ошибка загрузки товаров:', error);
      const errorMessage = error.response?.data?.message || 
                          error.message || 
                          'Ошибка загрузки товаров';
      toast.error(errorMessage);
      
      // Если ошибка 401, не показываем дополнительное сообщение (перехватчик API уже обработает)
      if (error.response?.status !== 401) {
        // Для других ошибок можно добавить дополнительную информацию
        if (error.response?.status === 500) {
          toast.error('Ошибка сервера. Попробуйте позже или обратитесь к администратору.');
        } else if (error.response?.status === 404) {
          toast.error('Эндпоинт не найден. Проверьте настройки API.');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      // Фильтр по статусу
      if (statusFilter !== 'all') {
        const hasMatchingStatus = product.businesses.some(b => b.status === statusFilter);
        if (!hasMatchingStatus) return false;
      }

      // Фильтр по категории
      if (categoryFilter !== 'all') {
        if (product.category !== categoryFilter) return false;
      }

      // Фильтр по остаткам
      if (stockFilter === 'in_stock') {
        const hasStock = product.businesses.some(b => b.stock.available > 0);
        if (!hasStock) return false;
      } else if (stockFilter === 'out_of_stock') {
        const hasNoStock = product.businesses.every(b => b.stock.available === 0);
        if (!hasNoStock) return false;
      }

      return true;
    });
  }, [products, statusFilter, categoryFilter, stockFilter]);

  const paginatedProducts = useMemo(() => {
    const startIndex = (page - 1) * itemsPerPage;
    return filteredProducts.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredProducts, page, itemsPerPage]);

  // Получаем уникальные статусы из всех товаров
  const availableStatuses = useMemo(() => {
    const statusSet = new Set<string>();
    products.forEach(product => {
      product.businesses.forEach(business => {
        if (business.status) statusSet.add(business.status);
      });
    });
    return Array.from(statusSet);
  }, [products]);

  // Экспорт данных в CSV
  const handleExportCSV = useCallback(() => {
    try {
      // Собираем все данные для экспорта (все страницы)
      const allProducts = filteredProducts;
      
      // Формируем CSV заголовки
      const headers = ['Артикул', 'Название', 'Категория', 'Бизнес', 'Цена', 'Остаток', 'Зарезервировано', 'Статус'];
      
      // Формируем CSV строки
      const rows = allProducts.flatMap(product => 
        product.businesses.map(business => [
          product.vendorCode,
          `"${product.name?.replace(/"/g, '""') || ''}"`,
          `"${product.category?.replace(/"/g, '""') || ''}"`,
          `"${business.businessName?.replace(/"/g, '""') || ''}"`,
          business.price.toString(),
          business.stock.available.toString(),
          (business.stock.reserved || 0).toString(),
          `"${translateStatus(business.status)}"`,
        ].join(','))
      );
      
      // Объединяем заголовки и строки
      const csvContent = [headers.join(','), ...rows].join('\n');
      
      // Создаем BOM для корректного отображения кириллицы в Excel
      const BOM = '\uFEFF';
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', `yandex-market-products-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success(`Экспортировано ${allProducts.length} товаров`);
    } catch (error: any) {
      console.error('Ошибка экспорта:', error);
      toast.error('Ошибка экспорта данных');
    }
  }, [filteredProducts]);

  // Обработчик изменения цены
  const handleUpdatePrice = async (vendorCode: string, newPrice: number) => {
    if (!newPrice || newPrice <= 0) {
      toast.error('Цена должна быть больше 0');
      return;
    }

    try {
      setUpdatingPrice(true);
      const response = await api.post('/yandex-market-go/products/update-price', {
        vendorCode,
        price: newPrice,
        currencyId: 'RUR',
      });

      if (response.data.success) {
        toast.success('Цена успешно обновлена во всех бизнесах');
        setEditingPrice(null);
        // Обновляем список товаров
        await fetchProducts();
      } else {
        const errors = response.data.results?.filter((r: any) => !r.success) || [];
        if (errors.length > 0) {
          toast.error(`Ошибка обновления: ${errors.map((e: any) => e.error).join(', ')}`);
        } else {
          toast.error('Ошибка обновления цены');
        }
      }
    } catch (error: any) {
      console.error('Ошибка обновления цены:', error);
      toast.error(error.response?.data?.message || 'Ошибка обновления цены');
    } finally {
      setUpdatingPrice(false);
    }
  };

  // Skeleton loader компонент
  const SkeletonRow = () => (
    <TableRow>
      <TableCell><Skeleton variant="rectangular" width={60} height={60} /></TableCell>
      <TableCell><Skeleton variant="text" width="80%" /></TableCell>
      <TableCell><Skeleton variant="text" width="60%" /></TableCell>
      <TableCell><Skeleton variant="text" width="40%" /></TableCell>
      <TableCell><Skeleton variant="text" width="30%" /></TableCell>
      <TableCell><Skeleton variant="text" width="50%" /></TableCell>
      <TableCell><Skeleton variant="rectangular" width={80} height={24} /></TableCell>
    </TableRow>
  );

  if (loading && products.length === 0) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Skeleton variant="text" width={300} height={40} />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Skeleton variant="rectangular" width={120} height={40} />
            <Skeleton variant="rectangular" width={120} height={40} />
          </Box>
        </Box>
        <Paper sx={{ p: 2, mb: 3 }}>
          <Skeleton variant="rectangular" width="100%" height={56} />
        </Paper>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Изображение</TableCell>
                <TableCell>Название</TableCell>
                <TableCell>Артикул</TableCell>
                <TableCell>Категория</TableCell>
                <TableCell>Бизнесы</TableCell>
                <TableCell>Цена</TableCell>
                <TableCell>Статус</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {[...Array(10)].map((_, i) => (
                <SkeletonRow key={i} />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
          Все товары Яндекс Маркет
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            startIcon={<FilterListIcon />}
            onClick={() => setShowFilters(!showFilters)}
            size={isMobile ? 'large' : 'medium'}
          >
            Фильтры {showFilters ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </Button>
          <Button
            variant="outlined"
            startIcon={<FileDownloadIcon />}
            onClick={handleExportCSV}
            size={isMobile ? 'large' : 'medium'}
            disabled={filteredProducts.length === 0}
          >
            {isMobile ? 'CSV' : 'Экспорт CSV'}
          </Button>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchProducts}
            size={isMobile ? 'large' : 'medium'}
            disabled={loading}
          >
            Обновить
          </Button>
        </Box>
      </Box>

      {/* Поиск */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <TextField
          fullWidth
          label="Поиск по артикулу или названию"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setPage(1);
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
            endAdornment: searchTerm && (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setSearchTerm('')}>
                  <ClearIcon />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
      </Paper>

      {/* Фильтры */}
      <Collapse in={showFilters}>
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Статус</InputLabel>
                <Select
                  value={statusFilter}
                  label="Статус"
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <MenuItem value="all">Все статусы</MenuItem>
                  {availableStatuses.map(status => (
                    <MenuItem key={status} value={status}>
                      {translateStatus(status)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Категория</InputLabel>
                <Select
                  value={categoryFilter}
                  label="Категория"
                  onChange={(e) => {
                    setCategoryFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <MenuItem value="all">Все категории</MenuItem>
                  {categories.map(category => (
                    <MenuItem key={category} value={category}>
                      {category}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Бизнес</InputLabel>
                <Select
                  value={businessFilter}
                  label="Бизнес"
                  onChange={(e) => {
                    setBusinessFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <MenuItem value="all">Все бизнесы</MenuItem>
                  {businesses.map(business => (
                    <MenuItem key={business.businessId} value={business.businessId}>
                      {business.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Остатки</InputLabel>
                <Select
                  value={stockFilter}
                  label="Остатки"
                  onChange={(e) => {
                    setStockFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <MenuItem value="all">Все</MenuItem>
                  <MenuItem value="in_stock">В наличии</MenuItem>
                  <MenuItem value="out_of_stock">Нет в наличии</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Paper>
      </Collapse>

      {/* Статистика */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <Typography variant="body2" color="text.secondary">
              Всего товаров
            </Typography>
            <Typography variant="h5" fontWeight="bold">
              {total}
            </Typography>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Typography variant="body2" color="text.secondary">
              Товаров с остатками
            </Typography>
            <Typography variant="h5" fontWeight="bold">
              {filteredProducts.filter(p => 
                p.businesses.some(b => b.stock.available > 0)
              ).length}
            </Typography>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Typography variant="body2" color="text.secondary">
              Всего бизнесов
            </Typography>
            <Typography variant="h5" fontWeight="bold">
              {new Set(filteredProducts.flatMap(p => p.businesses.map(b => b.businessId))).size}
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      {/* Список товаров */}
      {isMobile ? (
        // Мобильный вид - карточки
        <Grid container spacing={2}>
          {paginatedProducts.map((product) => (
            <Grid item xs={12} key={product.id}>
              <Card>
                {product.images && product.images.length > 0 && (
                  <CardMedia
                    component="img"
                    height="200"
                    image={product.images[0]}
                    alt={product.name}
                    sx={{ objectFit: 'contain', p: 1 }}
                  />
                )}
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {product.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Артикул: {product.vendorCode}
                  </Typography>
                  {product.category && (
                    <Chip
                      label={product.category}
                      size="small"
                      sx={{ mt: 1, mb: 2 }}
                    />
                  )}
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      В бизнесах ({product.businesses.length}):
                    </Typography>
                    {product.businesses.map((business, idx) => (
                      <Box key={idx} sx={{ mb: 1, p: 1, bgcolor: 'background.default', borderRadius: 1 }}>
                        <Typography variant="body2" fontWeight="bold">
                          {business.businessName}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
                          {editingPrice?.vendorCode === product.vendorCode ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <TextField
                                type="number"
                                size="small"
                                value={editingPrice.price}
                                onChange={(e) => setEditingPrice({ vendorCode: product.vendorCode, price: parseFloat(e.target.value) || 0 })}
                                inputProps={{ min: 0, step: 0.01, style: { width: '80px' } }}
                                disabled={updatingPrice}
                              />
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => handleUpdatePrice(product.vendorCode, editingPrice.price)}
                                disabled={updatingPrice}
                              >
                                <SaveIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                onClick={() => setEditingPrice(null)}
                                disabled={updatingPrice}
                              >
                                <CancelIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          ) : (
                            <>
                              <Chip
                                label={`Цена: ${business.price ? business.price.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '0'} ₽`}
                                size="small"
                                color="primary"
                              />
                              {idx === 0 && (
                                <IconButton
                                  size="small"
                                  onClick={() => setEditingPrice({ vendorCode: product.vendorCode, price: product.businesses[0].price })}
                                  disabled={updatingPrice}
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              )}
                            </>
                          )}
                          <Chip
                            label={`Остаток: ${business.stock.available}${business.stock.reserved ? ` (+${business.stock.reserved} рез.)` : ''}`}
                            color={business.stock.available > 0 ? 'success' : 'default'}
                            size="small"
                          />
                          {business.status && (
                            <Chip
                              label={translateStatus(business.status)}
                              size="small"
                              color={getStatusColor(business.status)}
                            />
                          )}
                        </Box>
                      </Box>
                    ))}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : (
        // Десктопный вид - таблица
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>Изображение</strong></TableCell>
                <TableCell><strong>Артикул</strong></TableCell>
                <TableCell><strong>Название</strong></TableCell>
                <TableCell><strong>Категория</strong></TableCell>
                <TableCell><strong>Бизнесы</strong></TableCell>
                <TableCell align="right"><strong>Цены</strong></TableCell>
                <TableCell align="right"><strong>Остатки</strong></TableCell>
                <TableCell><strong>Статусы</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedProducts.map((product) => (
                <TableRow key={product.id} hover>
                  <TableCell>
                    {product.images && product.images.length > 0 ? (
                      <Box
                        component="img"
                        src={product.images[0]}
                        alt={product.name}
                        sx={{
                          width: 60,
                          height: 60,
                          objectFit: 'contain',
                          borderRadius: 1,
                        }}
                      />
                    ) : (
                      <Box sx={{ width: 60, height: 60, bgcolor: 'background.default', borderRadius: 1 }} />
                    )}
                  </TableCell>
                  <TableCell>{product.vendorCode}</TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ maxWidth: 300 }}>
                      {product.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {product.category ? (
                      <Chip label={product.category} size="small" />
                    ) : (
                      <Typography variant="body2" color="text.secondary">—</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      {product.businesses.map((business, idx) => (
                        <Chip
                          key={idx}
                          label={business.businessName}
                          size="small"
                          variant="outlined"
                        />
                      ))}
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'flex-end' }}>
                      {product.businesses.map((business, idx) => (
                        <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          {editingPrice?.vendorCode === product.vendorCode ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <TextField
                                type="number"
                                size="small"
                                value={editingPrice.price}
                                onChange={(e) => setEditingPrice({ vendorCode: product.vendorCode, price: parseFloat(e.target.value) || 0 })}
                                inputProps={{ min: 0, step: 0.01, style: { width: '80px', textAlign: 'right' } }}
                                disabled={updatingPrice}
                              />
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => handleUpdatePrice(product.vendorCode, editingPrice.price)}
                                disabled={updatingPrice}
                              >
                                <SaveIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                onClick={() => setEditingPrice(null)}
                                disabled={updatingPrice}
                              >
                                <CancelIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          ) : (
                            <>
                              <Typography variant="body2" fontWeight="medium">
                                {business.price ? business.price.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '0'} ₽
                              </Typography>
                              {idx === 0 && (
                                <IconButton
                                  size="small"
                                  onClick={() => setEditingPrice({ vendorCode: product.vendorCode, price: product.businesses[0].price })}
                                  disabled={updatingPrice}
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              )}
                            </>
                          )}
                        </Box>
                      ))}
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'flex-end' }}>
                      {product.businesses.map((business, idx) => (
                        <Chip
                          key={idx}
                          label={`${business.stock.available}${business.stock.reserved ? ` (+${business.stock.reserved})` : ''}`}
                          color={business.stock.available > 0 ? 'success' : 'default'}
                          size="small"
                        />
                      ))}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      {product.businesses.map((business, idx) => (
                        business.status ? (
                          <Chip
                            key={idx}
                            label={translateStatus(business.status)}
                            size="small"
                            color={getStatusColor(business.status)}
                          />
                        ) : (
                          <Typography key={idx} variant="body2" color="text.secondary">—</Typography>
                        )
                      ))}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Пагинация */}
      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, value) => setPage(value)}
            color="primary"
            size={isMobile ? 'large' : 'medium'}
          />
        </Box>
      )}

      {filteredProducts.length === 0 && !loading && (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            Товары не найдены
          </Typography>
        </Paper>
      )}
    </Box>
  );
};

export default YandexMarketProducts;
