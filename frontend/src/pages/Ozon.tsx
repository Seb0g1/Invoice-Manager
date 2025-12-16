import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Paper,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Typography,
  CircularProgress,
  TextField,
  InputAdornment,
  IconButton,
  Chip,
  useMediaQuery,
  Button,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  ToggleButton,
  ToggleButtonGroup,
  Collapse,
  Pagination
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  Inventory as InventoryIcon,
  FilterList as FilterListIcon,
  ExpandMore as ExpandMoreIcon,
  Refresh as RefreshIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import api from '../services/api';
import { OzonProduct } from '../types';
import { useThemeContext } from '../contexts/ThemeContext';
import toast from 'react-hot-toast';

const Ozon: React.FC = () => {
  const [allProducts, setAllProducts] = useState<OzonProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState<{ current: number; total?: number } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [inStock, setInStock] = useState<string>('all');
  const [priceFrom, setPriceFrom] = useState<string>('');
  const [priceTo, setPriceTo] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [page, setPage] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const { theme, mode } = useThemeContext();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  useEffect(() => {
    // Проверяем, нужно ли автоматически обновить данные после синхронизации
    const shouldAutoRefresh = sessionStorage.getItem('ozonAutoRefresh') === 'true';
    if (shouldAutoRefresh) {
      sessionStorage.removeItem('ozonAutoRefresh');
      // Запускаем обновление с задержкой, чтобы страница успела загрузиться
      setTimeout(() => {
        fetchAllProducts(true);
      }, 500);
    } else {
      fetchAllProducts();
    }
  }, []);

  // Сбрасываем страницу при изменении фильтров
  useEffect(() => {
    setPage(0);
  }, [searchTerm, inStock, priceFrom, priceTo, statusFilter, sortBy, sortOrder]);

  const fetchAllProducts = async (forceRefresh: boolean = false) => {
    try {
      setLoading(true);
      setLoadingProgress({ current: 0 });
      
      // Всегда сначала пробуем загрузить из БД (кеша)
      // forceRefresh используется только для принудительного обновления через API OZON
      if (!forceRefresh) {
        try {
          // Загружаем все товары из БД одним запросом
          const cacheParams: any = { limit: 20000 }; // Большой лимит для получения всех товаров из БД
          const cacheResponse = await api.get('/ozon/products', { params: cacheParams });
          
          if (cacheResponse.data.fromCache && cacheResponse.data.products && cacheResponse.data.products.length > 0) {
            // Логируем первые несколько товаров для отладки
            if (cacheResponse.data.products.length > 0) {
              console.log('[DEBUG] Загружено товаров из БД:', cacheResponse.data.products.length);
              const sampleProducts = cacheResponse.data.products.slice(0, 3);
              sampleProducts.forEach((p: any) => {
                console.log(`[DEBUG] Товар ${p.productId} (${p.name}):`, {
                  stock: p.stock,
                  stockPresent: p.stock?.present,
                  hasStock: p.hasStock,
                  price: p.price,
                  primaryImage: p.primaryImage
                });
              });
            }
            setAllProducts(cacheResponse.data.products);
            setLoadingProgress(null);
            setLoading(false);
            // Не показываем toast при обычной загрузке из кеша
            return;
          }
        } catch (cacheError: any) {
          // Если ошибка загрузки из кеша, продолжаем загрузку через API
          console.log('Cache load failed, loading from API:', cacheError.message);
        }
      }
      
      // Загружаем через API
      let allProductsData: OzonProduct[] = [];
      let currentLastId: string | undefined = undefined;
      let hasMoreData = true;
      let iterationCount = 0;
      const maxIterations = 200; // Ограничиваем максимальное количество итераций (20,000 товаров)
      let consecutiveErrors = 0;
      const maxConsecutiveErrors = 3;

      // Загружаем все товары порциями по 100
      while (hasMoreData && iterationCount < maxIterations && consecutiveErrors < maxConsecutiveErrors) {
        try {
          const params: any = { limit: 100, forceRefresh: forceRefresh ? 'true' : 'false' };
          if (currentLastId) {
            params.lastId = currentLastId;
          }

          setLoadingProgress({ current: allProductsData.length });
          
          const response = await api.get('/ozon/products', { params });
          
          if (response.data.products && response.data.products.length > 0) {
            allProductsData = [...allProductsData, ...response.data.products];
            
            // Сохраняем предыдущий lastId для проверки зацикливания
            const previousLastId = currentLastId;
            currentLastId = response.data.lastId;
            
            // Проверяем, есть ли ещё товары для загрузки
            // Останавливаем, если:
            // 1. Получено меньше 100 товаров (последняя страница)
            // 2. Нет lastId (нет следующей страницы)
            // 3. lastId совпадает с предыдущим (зацикливание)
            const isLastPage = response.data.products.length < 100;
            const noNextPage = !response.data.lastId;
            const isLooping = currentLastId === previousLastId && currentLastId !== undefined;
            
            hasMoreData = !isLastPage && !noNextPage && !isLooping;
            
            iterationCount++;
            consecutiveErrors = 0; // Сбрасываем счётчик ошибок при успехе
            
            // Обновляем состояние для отображения прогресса
            setAllProducts([...allProductsData]);
            setLoadingProgress({ current: allProductsData.length });
            
            // Небольшая задержка между запросами для избежания rate limit
            if (hasMoreData) {
              await new Promise(resolve => setTimeout(resolve, 300));
            }
          } else {
            hasMoreData = false;
          }
        } catch (error: any) {
          consecutiveErrors++;
          
          // Если ошибка rate limit, ждём и пробуем снова
          if (error.response?.data?.message?.includes('rate limit')) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
          }
          
          // Если слишком много ошибок подряд, останавливаем загрузку
          if (consecutiveErrors >= maxConsecutiveErrors) {
            console.error('Too many consecutive errors, stopping load');
            break;
          }
          
          // Для других ошибок продолжаем, но логируем
          console.error(`Error loading batch ${iterationCount}:`, error.message);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      setLoadingProgress(null);
      
      if (iterationCount >= maxIterations) {
        toast.error(`Загружено ${allProductsData.length} товаров (достигнут лимит загрузки)`);
      } else if (consecutiveErrors >= maxConsecutiveErrors) {
        toast.error(`Загружено ${allProductsData.length} товаров (остановлено из-за ошибок)`);
      } else {
        toast.success(`Загружено товаров: ${allProductsData.length}`);
      }
    } catch (error: any) {
      setLoadingProgress(null);
      toast.error(error.response?.data?.message || 'Ошибка при загрузке товаров OZON');
      if (error.response?.status === 500 && error.response?.data?.message?.includes('не настроен')) {
        toast.error('OZON API не настроен. Настройте подключение в настройках.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    // Фильтрация происходит автоматически через filteredProducts
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setInStock('all');
    setPriceFrom('');
    setPriceTo('');
    setStatusFilter('all');
    setSortBy('name');
    setSortOrder('asc');
    setPage(0); // Сбрасываем страницу при очистке фильтров
    // Фильтрация происходит автоматически через filteredProducts
  };

  const handleRefreshFromDB = async () => {
    try {
      setLoading(true);
      setLoadingProgress({ current: 0 });
      
      // Загружаем все товары из БД одним запросом
      const cacheParams: any = { limit: 20000 }; // Большой лимит для получения всех товаров из БД
      const cacheResponse = await api.get('/ozon/products', { params: cacheParams });
      
      if (cacheResponse.data.products && cacheResponse.data.products.length > 0) {
        setAllProducts(cacheResponse.data.products);
        toast.success(`Обновлено товаров из БД: ${cacheResponse.data.products.length}`);
      } else {
        toast.error('Не удалось загрузить товары из БД');
      }
    } catch (error: any) {
      console.error('Ошибка при обновлении из БД:', error);
      toast.error('Ошибка при обновлении данных из БД');
    } finally {
      setLoading(false);
      setLoadingProgress(null);
    }
  };

  // Фильтрация и сортировка продуктов с мемоизацией
  const filteredProducts = useMemo(() => {
    return allProducts.filter((product) => {
      // Поиск
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        if (!product.name.toLowerCase().includes(searchLower) &&
            !product.offerId?.toLowerCase().includes(searchLower) &&
            !(product.sku ? String(product.sku).toLowerCase().includes(searchLower) : false)) {
          return false;
        }
      }
      
      // Фильтр по наличию - используем полный остаток (present + reserved)
      const totalStock = product.stock 
        ? (product.stock.present || 0) + (product.stock.reserved || 0)
        : 0;
      if (inStock === 'inStock' && totalStock === 0) {
        return false;
      }
      if (inStock === 'outOfStock' && totalStock > 0) {
        return false;
      }
      
      // Фильтр по цене
      if (priceFrom && product.price < parseFloat(priceFrom)) {
        return false;
      }
      if (priceTo && product.price > parseFloat(priceTo)) {
        return false;
      }
      
      // Фильтр по статусу
      if (statusFilter !== 'all' && product.status !== statusFilter) {
        return false;
      }
      
      return true;
    }).sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name, 'ru');
          break;
        case 'price':
          comparison = a.price - b.price;
          break;
        case 'stock':
          // Сортируем по полному остатку (present + reserved)
          const totalStockA = a.stock 
            ? (a.stock.present || 0) + (a.stock.reserved || 0)
            : 0;
          const totalStockB = b.stock 
            ? (b.stock.present || 0) + (b.stock.reserved || 0)
            : 0;
          comparison = totalStockA - totalStockB;
          break;
        case 'sku':
          comparison = a.sku - b.sku;
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status, 'ru');
          break;
        default:
          comparison = 0;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [allProducts, searchTerm, inStock, priceFrom, priceTo, statusFilter, sortBy, sortOrder]);

  // Пагинация
  const paginatedProducts = useMemo(() => {
    const startIndex = page * itemsPerPage;
    return filteredProducts.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredProducts, page, itemsPerPage]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);

  if (loading && allProducts.length === 0) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '400px',
          gap: 2,
        }}
      >
        <CircularProgress size={60} />
        <Typography variant="body1" color="text.secondary">
          Загрузка товаров...
        </Typography>
        {loadingProgress && (
          <Typography variant="body2" color="text.secondary">
            Загружено: {loadingProgress.current} товаров
          </Typography>
        )}
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2, md: 3 } }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontSize: { xs: '1.5rem', sm: '2rem' }, mb: 2 }}>
          Товары OZON
        </Typography>
        
        {/* Поиск */}
        <TextField
          fullWidth
          label="Поиск товара"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          size="small"
          sx={{ mb: 2 }}
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

        {/* Кнопка фильтров */}
        <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <Button
            variant="outlined"
            startIcon={<FilterListIcon />}
            endIcon={filtersExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            onClick={() => setFiltersExpanded(!filtersExpanded)}
            size={isMobile ? "large" : "medium"}
            sx={{ minHeight: { xs: 44, sm: 'auto' } }}
          >
            Фильтры
          </Button>

          {/* Кнопка обновления данных из БД */}
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleRefreshFromDB}
            disabled={loading}
            size={isMobile ? "large" : "medium"}
            sx={{ minHeight: { xs: 44, sm: 'auto' } }}
          >
            Обновить
          </Button>
          
          <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 150 } }}>
            <InputLabel>Сортировка</InputLabel>
            <Select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              label="Сортировка"
            >
              <MenuItem value="name">По названию</MenuItem>
              <MenuItem value="price">По цене</MenuItem>
              <MenuItem value="stock">По остатку</MenuItem>
              <MenuItem value="sku">По SKU</MenuItem>
              <MenuItem value="status">По статусу</MenuItem>
            </Select>
          </FormControl>

          <ToggleButtonGroup
            value={sortOrder}
            exclusive
            onChange={(_e, newOrder) => newOrder && setSortOrder(newOrder)}
            size="small"
            sx={{ minHeight: { xs: 44, sm: 'auto' } }}
          >
            <ToggleButton value="asc" aria-label="по возрастанию">
              ↑
            </ToggleButton>
            <ToggleButton value="desc" aria-label="по убыванию">
              ↓
            </ToggleButton>
          </ToggleButtonGroup>

          {(searchTerm || inStock !== 'all' || priceFrom || priceTo || statusFilter !== 'all') && (
            <Button
              variant="outlined"
              color="error"
              onClick={handleClearFilters}
              size={isMobile ? "large" : "medium"}
              sx={{ minHeight: { xs: 44, sm: 'auto' } }}
            >
              Сбросить
            </Button>
          )}
        </Box>

        {/* Панель фильтров */}
        <Collapse in={filtersExpanded}>
          <Paper sx={{ p: 2, mb: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Наличие</InputLabel>
                  <Select
                    value={inStock}
                    onChange={(e) => setInStock(e.target.value)}
                    label="Наличие"
                  >
                    <MenuItem value="all">Все товары</MenuItem>
                    <MenuItem value="inStock">В наличии</MenuItem>
                    <MenuItem value="outOfStock">Нет в наличии</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Статус</InputLabel>
                  <Select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    label="Статус"
                  >
                    <MenuItem value="all">Все статусы</MenuItem>
                    <MenuItem value="active">Активные</MenuItem>
                    <MenuItem value="archived">Архивные</MenuItem>
                    <MenuItem value="disabling">Отключаемые</MenuItem>
                    <MenuItem value="disabled">Отключенные</MenuItem>
                    <MenuItem value="failed">Ошибка</MenuItem>
                    <MenuItem value="processing">В обработке</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  label="Цена от"
                  type="number"
                  value={priceFrom}
                  onChange={(e) => setPriceFrom(e.target.value)}
                  size="small"
                  InputProps={{
                    endAdornment: <InputAdornment position="end">₽</InputAdornment>,
                    style: { textTransform: 'none' }
                  }}
                  inputProps={{
                    style: { textTransform: 'none' },
                    min: 0,
                    step: 0.01
                  }}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  label="Цена до"
                  type="number"
                  value={priceTo}
                  onChange={(e) => setPriceTo(e.target.value)}
                  size="small"
                  InputProps={{
                    endAdornment: <InputAdornment position="end">₽</InputAdornment>,
                    style: { textTransform: 'none' }
                  }}
                  inputProps={{
                    style: { textTransform: 'none' },
                    min: 0,
                    step: 0.01
                  }}
                />
              </Grid>
            </Grid>
          </Paper>
        </Collapse>

        {/* Информация о результатах */}
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="body2" color="text.secondary">
            Найдено товаров: {filteredProducts.length} из {allProducts.length}
          </Typography>
          {loading && loadingProgress && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={16} />
              <Typography variant="caption" color="text.secondary">
                Загружено: {loadingProgress.current}
              </Typography>
            </Box>
          )}
          {inStock === 'inStock' && (
            <Chip label="В наличии" size="small" color="primary" />
          )}
          {inStock === 'outOfStock' && (
            <Chip label="Нет в наличии" size="small" />
          )}
          {statusFilter !== 'all' && (
            <Chip label={`Статус: ${statusFilter}`} size="small" />
          )}
        </Box>
      </Box>

      {allProducts.length === 0 && !loading ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <InventoryIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            Товары не найдены
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Настройте подключение к OZON API в настройках
          </Typography>
        </Paper>
      ) : (
        <>
          <Grid container spacing={2}>
            {paginatedProducts.map((product) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={product.productId}>
                <Card
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: mode === 'dark'
                        ? '0 12px 24px rgba(0, 0, 0, 0.5)'
                        : '0 12px 24px rgba(0, 0, 0, 0.15)',
                    },
                  }}
                >
                  {product.primaryImage ? (
                    <CardMedia
                      component="img"
                      height="200"
                      image={product.primaryImage}
                      alt={product.name}
                      sx={{
                        objectFit: 'contain',
                        bgcolor: mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                        p: 1,
                      }}
                    />
                  ) : (
                    <Box
                      sx={{
                        height: 200,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                      }}
                    >
                      <InventoryIcon sx={{ fontSize: 64, color: 'text.secondary' }} />
                    </Box>
                  )}
                  <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                    <Typography
                      variant="h6"
                      component="h3"
                      sx={{
                        fontSize: { xs: '0.875rem', sm: '1rem' },
                        fontWeight: 600,
                        mb: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        minHeight: { xs: '2.5rem', sm: '3rem' },
                      }}
                    >
                      {product.name}
                    </Typography>
                    <Box sx={{ mb: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      <Chip
                        label={product.status}
                        size="small"
                        color={product.status === 'active' ? 'success' : 'default'}
                      />
                      {product.stock && (
                        <>
                          <Chip
                            label={`Остаток: ${(product.stock.present || 0) + (product.stock.reserved || 0)}`}
                            size="small"
                            color={(product.stock.present || 0) + (product.stock.reserved || 0) > 0 ? 'primary' : 'default'}
                          />
                          {(product.stock.present || 0) > 0 && (product.stock.reserved || 0) > 0 && (
                            <Chip
                              label={`В наличии: ${product.stock.present}, Зарезервировано: ${product.stock.reserved}`}
                              size="small"
                              color="info"
                              sx={{ fontSize: '0.7rem' }}
                            />
                          )}
                        </>
                      )}
                      {!product.stock && (
                        <Chip
                          label="Остаток: 0"
                          size="small"
                          color="default"
                        />
                      )}
                    </Box>
                    <Box sx={{ mt: 'auto', pt: 1 }}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        SKU: {product.sku || '-'}
                      </Typography>
                      {product.offerId && (
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Offer ID: {product.offerId}
                        </Typography>
                      )}
                      {product.price > 0 ? (
                        <>
                          <Typography
                            variant="h6"
                            sx={{
                              fontWeight: 700,
                              color: 'primary.main',
                              mt: 1,
                            }}
                          >
                            {product.price.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {product.currency === 'RUB' ? '₽' : product.currency}
                          </Typography>
                          {product.oldPrice && product.oldPrice > product.price && (
                            <Typography
                              variant="body2"
                              sx={{
                                textDecoration: 'line-through',
                                color: 'text.secondary',
                              }}
                            >
                              {product.oldPrice.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {product.currency === 'RUB' ? '₽' : product.currency}
                            </Typography>
                          )}
                        </>
                      ) : (
                        <Typography
                          variant="body2"
                          sx={{
                            color: 'text.secondary',
                            fontStyle: 'italic',
                            mt: 1,
                          }}
                        >
                          Цена не указана
                        </Typography>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
          
          {/* Пагинация */}
          {filteredProducts.length > itemsPerPage && (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2, mt: 3, flexWrap: 'wrap' }}>
              <Pagination
                count={totalPages}
                page={page + 1}
                onChange={(_event, value) => setPage(value - 1)}
                color="primary"
                size={isMobile ? "small" : "medium"}
                showFirstButton
                showLastButton
              />
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <Select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setPage(0);
                  }}
                >
                  <MenuItem value={25}>25</MenuItem>
                  <MenuItem value={50}>50</MenuItem>
                  <MenuItem value={100}>100</MenuItem>
                  <MenuItem value={200}>200</MenuItem>
                </Select>
              </FormControl>
              <Typography variant="body2" color="text.secondary">
                Показано {page * itemsPerPage + 1}-{Math.min((page + 1) * itemsPerPage, filteredProducts.length)} из {filteredProducts.length}
              </Typography>
            </Box>
          )}
          
          {filteredProducts.length === 0 && allProducts.length > 0 && (
            <Paper sx={{ p: 4, textAlign: 'center', mt: 2 }}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                Товары не найдены
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Попробуйте изменить фильтры
              </Typography>
            </Paper>
          )}
        </>
      )}
    </Box>
  );
};

export default Ozon;

