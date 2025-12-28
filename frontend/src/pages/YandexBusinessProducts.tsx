import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  CircularProgress,
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
  Breadcrumbs,
  Link,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Collapse,
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  Refresh as RefreshIcon,
  ArrowBack as ArrowBackIcon,
  Store as StoreIcon,
  FilterList as FilterListIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import api from '../services/api';
import { useThemeContext } from '../contexts/ThemeContext';
import toast from 'react-hot-toast';

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

interface BusinessInfo {
  businessId: string;
  name: string;
}

interface Product {
  id: string;
  vendorCode: string;
  name: string;
  description?: string;
  images: string[];
  category?: string;
  business: {
    businessId: string;
    businessName: string;
    offerId: string;
    price: number;
    stock: {
      available: number;
      reserved?: number;
    };
    status?: string;
  };
}

const YandexBusinessProducts: React.FC = () => {
  const { businessId } = useParams<{ businessId: string }>();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [business, setBusiness] = useState<BusinessInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<string>('all'); // all, in_stock, out_of_stock
  const [page, setPage] = useState(1);
  const [itemsPerPage] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [availableStatuses, setAvailableStatuses] = useState<string[]>([]);
  const { theme } = useThemeContext();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  useEffect(() => {
    if (businessId) {
      fetchProducts();
    }
  }, [businessId, page, searchTerm, statusFilter, stockFilter]);

  const fetchProducts = async () => {
    if (!businessId) return;

    try {
      setLoading(true);
      const response = await api.get(`/yandex-market-go/businesses/${businessId}/products`, {
        params: {
          page,
          limit: itemsPerPage,
          search: searchTerm || undefined,
        },
      });

      if (response.data) {
        const productsData = response.data.products || [];
        setProducts(productsData);
        setBusiness(response.data.business);
        setTotalPages(response.data.pagination?.totalPages || 1);
        setTotal(response.data.pagination?.total || 0);
        
        // Собираем уникальные статусы
        const statusSet = new Set<string>();
        productsData.forEach((p: Product) => {
          if (p.business.status) statusSet.add(p.business.status);
        });
        setAvailableStatuses(Array.from(statusSet));
      }
    } catch (error: any) {
      console.error('Ошибка загрузки товаров:', error);
      toast.error(error.response?.data?.message || 'Ошибка загрузки товаров');
    } finally {
      setLoading(false);
    }
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setPage(1);
  };

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      // Фильтр по статусу
      if (statusFilter !== 'all') {
        if (product.business.status !== statusFilter) return false;
      }

      // Фильтр по остаткам
      if (stockFilter === 'in_stock') {
        const totalStock = (product.business.stock?.available || 0) + (product.business.stock?.reserved || 0);
        if (totalStock === 0) return false;
      } else if (stockFilter === 'out_of_stock') {
        const totalStock = (product.business.stock?.available || 0) + (product.business.stock?.reserved || 0);
        if (totalStock > 0) return false;
      }

      return true;
    });
  }, [products, statusFilter, stockFilter]);

  if (loading && !products.length) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Breadcrumbs sx={{ mb: 3 }}>
        <Link
          component="button"
          variant="body1"
          onClick={() => navigate('/yandex-market/businesses')}
          sx={{ cursor: 'pointer', textDecoration: 'none' }}
        >
          Бизнесы
        </Link>
        <Typography color="text.primary">
          {business?.name || businessId}
        </Typography>
      </Breadcrumbs>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/yandex-market/businesses')}
            variant="outlined"
          >
            Назад
          </Button>
          <Box>
            <Typography variant="h5" component="h1">
              {business?.name || 'Товары бизнеса'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Business ID: {businessId}
            </Typography>
          </Box>
        </Box>
        <Button
          startIcon={<RefreshIcon />}
          onClick={fetchProducts}
          variant="outlined"
        >
          Обновить
        </Button>
      </Box>

      <Paper sx={{ p: 2, mb: 3 }}>
        <TextField
          fullWidth
          placeholder="Поиск по артикулу или названию..."
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
                <IconButton size="small" onClick={handleClearSearch}>
                  <ClearIcon />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
      </Paper>

      {/* Фильтры */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Button
            variant="outlined"
            startIcon={<FilterListIcon />}
            onClick={() => setShowFilters(!showFilters)}
            size="small"
          >
            Фильтры {showFilters ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </Button>
        </Box>
        <Collapse in={showFilters}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
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
            <Grid item xs={12} sm={6}>
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
        </Collapse>
      </Paper>

      {filteredProducts.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <StoreIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            Товары не найдены
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {searchTerm
              ? 'Попробуйте изменить поисковый запрос'
              : 'Для этого бизнеса пока нет товаров. Выполните синхронизацию товаров.'}
          </Typography>
        </Paper>
      ) : (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Найдено товаров: {total}
          </Typography>

          {isMobile ? (
            <Grid container spacing={2}>
              {filteredProducts.map((product) => (
                <Grid item xs={12} key={product.id}>
                  <Card>
                    {product.images && product.images.length > 0 && (
                      <CardMedia
                        component="img"
                        height="200"
                        image={product.images[0]}
                        alt={product.name}
                        sx={{ objectFit: 'contain', bgcolor: 'grey.100' }}
                      />
                    )}
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        {product.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Артикул: {product.vendorCode}
                      </Typography>
                      <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Chip
                          label={`Цена: ${product.business.price?.toLocaleString('ru-RU')} ₽`}
                          color="primary"
                          size="small"
                        />
                        <Chip
                          label={`Остаток: ${product.business.stock?.available || 0}${product.business.stock?.reserved ? ` (+${product.business.stock.reserved} рез.)` : ''}`}
                          color={(product.business.stock?.available || 0) > 0 ? 'success' : 'default'}
                          size="small"
                        />
                        {product.business.status && (
                          <Chip
                            label={translateStatus(product.business.status)}
                            size="small"
                            color={getStatusColor(product.business.status)}
                          />
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Изображение</TableCell>
                    <TableCell>Название</TableCell>
                    <TableCell>Артикул</TableCell>
                    <TableCell align="right">Цена</TableCell>
                    <TableCell align="right">Остаток</TableCell>
                    <TableCell>Статус</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredProducts.map((product) => (
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
                              bgcolor: 'grey.100',
                              borderRadius: 1,
                            }}
                          />
                        ) : (
                          <Box
                            sx={{
                              width: 60,
                              height: 60,
                              bgcolor: 'grey.200',
                              borderRadius: 1,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <StoreIcon sx={{ color: 'grey.400' }} />
                          </Box>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {product.name}
                        </Typography>
                        {product.description && (
                          <Typography variant="caption" color="text.secondary">
                            {product.description.substring(0, 100)}...
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{product.vendorCode}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight="medium">
                          {product.business.price?.toLocaleString('ru-RU')} ₽
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Chip
                          label={`${product.business.stock?.available || 0}${product.business.stock?.reserved ? ` (+${product.business.stock.reserved})` : ''}`}
                          color={(product.business.stock?.available || 0) > 0 ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {product.business.status ? (
                          <Chip
                            label={translateStatus(product.business.status)}
                            size="small"
                            color={getStatusColor(product.business.status)}
                          />
                        ) : (
                          <Typography variant="body2" color="text.secondary">—</Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(_, value) => setPage(value)}
                color="primary"
              />
            </Box>
          )}
        </>
      )}
    </Box>
  );
};

export default YandexBusinessProducts;

