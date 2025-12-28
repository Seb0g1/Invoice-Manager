import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  LinearProgress,
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  Inventory as InventoryIcon,
  Sync as SyncIcon
} from '@mui/icons-material';
import api from '../services/api';
import { YandexProduct, YandexAccount } from '../types';
import { useThemeContext } from '../contexts/ThemeContext';
import toast from 'react-hot-toast';

const Yandex: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<YandexProduct[]>([]);
  const [accounts, setAccounts] = useState<YandexAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const { theme, mode } = useThemeContext();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  useEffect(() => {
    fetchAccounts();
  }, []);

  // Синхронизируем selectedAccountId с URL параметрами
  useEffect(() => {
    const accountIdFromUrl = searchParams.get('accountId');
    if (accountIdFromUrl) {
      setSelectedAccountId(accountIdFromUrl);
    } else if (accounts.length > 0 && !selectedAccountId) {
      // Если нет accountId в URL и нет выбранного аккаунта, показываем все товары
      setSelectedAccountId('');
    }
  }, [searchParams, accounts]);

  useEffect(() => {
    fetchProducts();
  }, [selectedAccountId, page]);

  const fetchAccounts = async () => {
    try {
      const response = await api.get('/yandex/accounts');
      setAccounts(response.data);
      if (response.data.length > 0 && !selectedAccountId) {
        setSelectedAccountId(response.data[0]._id);
      }
    } catch (error: any) {
      if (error.response?.status !== 403) {
        toast.error('Ошибка при загрузке аккаунтов Yandex');
      }
    }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      
      // Если не выбран аккаунт, получаем товары со всех аккаунтов
      if (!selectedAccountId) {
        const allProducts: YandexProduct[] = [];
        for (const account of accounts.filter(a => a.enabled)) {
          try {
            const params: any = {
              accountId: account._id,
              page: 1,
              pageSize: 1000, // Большой лимит для получения всех товаров
            };
            if (account.businessId) {
              params.businessId = account.businessId;
            }
            const response = await api.get('/yandex/products', { params });
            allProducts.push(...response.data.products);
          } catch (error) {
            console.error(`Ошибка загрузки товаров для аккаунта ${account.name}:`, error);
          }
        }
        setProducts(allProducts);
        setHasMore(false);
        return;
      }

      // Загружаем товары конкретного аккаунта
      const account = accounts.find(a => a._id === selectedAccountId);
      if (!account) return;

      const params: any = {
        accountId: selectedAccountId,
        page,
        pageSize: 50,
      };
      if (account.businessId) {
        params.businessId = account.businessId;
      }

      const response = await api.get('/yandex/products', { params });
      if (page === 1) {
        setProducts(response.data.products);
      } else {
        setProducts((prev) => [...prev, ...response.data.products]);
      }
      setHasMore(response.data.page < response.data.pages);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Ошибка при загрузке товаров Yandex');
      if (error.response?.data?.message?.includes('не настроен')) {
        toast.error('Yandex аккаунт не настроен. Настройте подключение в настройках.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    // Если не выбран аккаунт, синхронизируем все аккаунты
    if (!selectedAccountId) {
      const enabledAccounts = accounts.filter(a => a.enabled);
      if (enabledAccounts.length === 0) {
        toast.error('Нет активных аккаунтов для синхронизации');
        return;
      }
      
      try {
        setSyncing(true);
        setSyncProgress({ current: 0, total: enabledAccounts.length });
        
        for (let i = 0; i < enabledAccounts.length; i++) {
          const account = enabledAccounts[i];
          try {
            await api.post('/yandex/sync', {
              accountId: account._id,
              businessId: account.businessId
            });
            setSyncProgress({ current: i + 1, total: enabledAccounts.length });
          } catch (error: any) {
            console.error(`Ошибка синхронизации аккаунта ${account.name}:`, error);
          }
        }
        
        toast.success('Синхронизация всех аккаунтов завершена');
        await fetchProducts(); // Обновляем список товаров
      } catch (error: any) {
        toast.error('Ошибка при синхронизации');
      } finally {
        setSyncing(false);
        setSyncProgress({ current: 0, total: 0 });
      }
      return;
    }

    setSyncing(true);
    setSyncProgress({ current: 0, total: 0 });

    try {
      const account = accounts.find(a => a._id === selectedAccountId);
      if (!account) return;

      await api.post('/yandex/sync', {
        accountId: selectedAccountId,
        businessId: account.businessId,
      });

      toast.success('Синхронизация начата');
      // В реальном приложении здесь нужно использовать WebSocket или polling для получения прогресса
      setTimeout(() => {
        fetchProducts();
        setSyncing(false);
      }, 2000);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Ошибка при синхронизации');
      setSyncing(false);
    }
  };

  const filteredProducts = products.filter((product) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      product.name.toLowerCase().includes(searchLower) ||
      product.offerId?.toLowerCase().includes(searchLower) ||
      product.sku?.toLowerCase().includes(searchLower) ||
      product.vendor?.toLowerCase().includes(searchLower)
    );
  });

  if (accounts.length === 0) {
    return (
      <Box sx={{ p: { xs: 1.5, sm: 2, md: 3 } }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <InventoryIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            Аккаунты Yandex Market не настроены
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Настройте подключение к Yandex Market API в настройках
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2, md: 3 } }}>
      <Box sx={{ mb: 3 }}>
        <Box sx={{ 
          display: 'flex', 
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', sm: 'center' },
          gap: 2,
          mb: 2
        }}>
          <Typography variant="h4" sx={{ fontSize: { xs: '1.5rem', sm: '2rem' } }}>
            Товары Yandex Market
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, width: { xs: '100%', sm: 'auto' } }}>
            <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 200 } }}>
              <InputLabel>Аккаунт</InputLabel>
              <Select
                value={selectedAccountId || 'all'}
                onChange={(e) => {
                  const newAccountId = e.target.value === 'all' ? '' : e.target.value;
                  setSelectedAccountId(newAccountId);
                  setPage(1);
                  setProducts([]);
                  // Обновляем URL
                  if (newAccountId) {
                    setSearchParams({ accountId: newAccountId });
                  } else {
                    setSearchParams({});
                  }
                }}
                label="Аккаунт"
              >
                <MenuItem value="all">Общие товары (со всех аккаунтов)</MenuItem>
                {accounts.map((account) => (
                  <MenuItem key={account._id} value={account._id}>
                    {account.name} {account.enabled ? '' : '(отключен)'}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              variant="outlined"
              startIcon={<SyncIcon />}
              onClick={handleSync}
              disabled={syncing || accounts.filter(a => a.enabled).length === 0}
              size={isMobile ? "medium" : "small"}
              sx={{ minHeight: { xs: 44, sm: 'auto' } }}
            >
              {syncing 
                ? (selectedAccountId ? 'Синхронизация...' : `Синхронизация (${syncProgress.current}/${syncProgress.total})...`)
                : (selectedAccountId ? 'Синхронизировать' : 'Синхронизировать все аккаунты')
              }
            </Button>
          </Box>
        </Box>

        {syncing && (
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Синхронизация товаров...
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {syncProgress.current > 0 && syncProgress.total > 0
                  ? `${syncProgress.current} / ${syncProgress.total}`
                  : 'Загрузка...'}
              </Typography>
            </Box>
            <LinearProgress 
              variant={syncProgress.total > 0 ? "determinate" : "indeterminate"}
              value={syncProgress.total > 0 ? (syncProgress.current / syncProgress.total) * 100 : 0}
            />
          </Box>
        )}

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
      </Box>

      {loading && products.length === 0 ? (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '400px',
          }}
        >
          <CircularProgress />
        </Box>
      ) : filteredProducts.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <InventoryIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            Товары не найдены
          </Typography>
        </Paper>
      ) : (
        <>
          <Grid container spacing={2}>
            {filteredProducts.map((product) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={product.id}>
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
                        label={product.availability === 'ACTIVE' ? 'В наличии' : product.availability}
                        size="small"
                        color={product.availability === 'ACTIVE' ? 'success' : 'default'}
                      />
                      {product.count > 0 && (
                        <Chip
                          label={`Остаток: ${product.count}`}
                          size="small"
                          color="primary"
                        />
                      )}
                    </Box>
                    <Box sx={{ mt: 'auto', pt: 1 }}>
                      {product.vendor && (
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Производитель: {product.vendor}
                        </Typography>
                      )}
                      {product.offerId && (
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Offer ID: {product.offerId}
                        </Typography>
                      )}
                      <Typography
                        variant="h6"
                        sx={{
                          fontWeight: 700,
                          color: 'primary.main',
                          mt: 1,
                        }}
                      >
                        {product.price.toLocaleString('ru-RU')} {product.currency === 'RUR' ? '₽' : product.currency}
                      </Typography>
                      {product.oldPrice && product.oldPrice > product.price && (
                        <Typography
                          variant="body2"
                          sx={{
                            textDecoration: 'line-through',
                            color: 'text.secondary',
                          }}
                        >
                          {product.oldPrice.toLocaleString('ru-RU')} {product.currency === 'RUR' ? '₽' : product.currency}
                        </Typography>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
          {hasMore && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
              <Button
                variant="outlined"
                onClick={() => setPage(page + 1)}
                disabled={loading}
                size={isMobile ? "large" : "medium"}
                sx={{ minHeight: { xs: 44, sm: 'auto' } }}
              >
                {loading ? <CircularProgress size={24} /> : 'Загрузить еще'}
              </Button>
            </Box>
          )}
        </>
      )}
    </Box>
  );
};

export default Yandex;

