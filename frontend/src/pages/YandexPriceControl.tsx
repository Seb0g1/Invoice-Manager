import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  Grid,
  Chip,
  useMediaQuery,
  InputAdornment,
  IconButton,
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  Update as UpdateIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import api from '../services/api';
import { useThemeContext } from '../contexts/ThemeContext';
import toast from 'react-hot-toast';

interface BusinessInfo {
  businessId: string;
  businessName: string;
  offerId: string;
  sku: string;
  price: number;
  stock: {
    available: number;
    reserved?: number;
  };
  status?: string;
  lastSync?: string;
}

interface ProductInfo {
  id: string;
  vendorCode: string;
  name: string;
  description?: string;
  images: string[];
  category?: string;
}

interface ProductData {
  product: ProductInfo;
  businesses: BusinessInfo[];
}

const YandexPriceControl: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [productData, setProductData] = useState<ProductData | null>(null);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [newPrice, setNewPrice] = useState<string>('');
  const [updateResults, setUpdateResults] = useState<Array<{
    businessId: string;
    businessName: string;
    success: boolean;
    error?: string;
  }>>([]);
  const { theme } = useThemeContext();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      toast.error('Введите артикул для поиска');
      return;
    }

    try {
      setLoading(true);
      setProductData(null);
      setUpdateResults([]);
      setNewPrice('');

      const response = await api.get(`/yandex-market-go/products/${encodeURIComponent(searchTerm.trim())}`);
      
      if (response.data) {
        setProductData(response.data);
        // Устанавливаем минимальную цену из всех бизнесов как начальное значение
        if (response.data.businesses && response.data.businesses.length > 0) {
          const minPrice = Math.min(...response.data.businesses.map((b: BusinessInfo) => b.price || 0));
          if (minPrice > 0) {
            setNewPrice(minPrice.toString());
          }
        }
        toast.success(`Найден товар: ${response.data.product.name}`);
      } else {
        toast.error('Товар не найден');
      }
    } catch (error: any) {
      console.error('Ошибка поиска товара:', error);
      if (error.response?.status === 404) {
        toast.error('Товар не найден');
      } else {
        toast.error(error.response?.data?.message || 'Ошибка при поиске товара');
      }
      setProductData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePrice = async () => {
    if (!productData || !newPrice.trim()) {
      toast.error('Введите новую цену');
      return;
    }

    const priceValue = parseFloat(newPrice.trim());
    if (isNaN(priceValue) || priceValue <= 0) {
      toast.error('Цена должна быть положительным числом');
      return;
    }

    try {
      setUpdating(true);
      setUpdateResults([]);

      const response = await api.post('/yandex-market-go/products/update-price', {
        vendorCode: productData.product.vendorCode,
        price: priceValue,
        currencyId: 'RUR',
      });

      if (response.data) {
        setUpdateResults(response.data.results || []);
        
        // Обновляем данные товара
        if (response.data.success) {
          toast.success('Цена успешно обновлена во всех бизнесах!');
          // Обновляем данные товара
          handleSearch();
        } else {
          const failedCount = response.data.results?.filter((r: any) => !r.success).length || 0;
          toast.error(`Ошибка обновления цены в ${failedCount} бизнесах`);
        }
      }
    } catch (error: any) {
      console.error('Ошибка обновления цены:', error);
      toast.error(error.response?.data?.message || 'Ошибка при обновлении цены');
    } finally {
      setUpdating(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 3, fontWeight: 700 }}>
        Управление ценами Яндекс Маркет
      </Typography>

      {/* Поиск по артикулу */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={8} md={6}>
            <TextField
              fullWidth
              label="Артикул (vendorCode)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Введите артикул товара"
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
          </Grid>
          <Grid item xs={12} sm={4} md={6}>
            <Button
              fullWidth={isMobile}
              variant="contained"
              onClick={handleSearch}
              disabled={loading || !searchTerm.trim()}
              startIcon={loading ? <CircularProgress size={20} /> : <SearchIcon />}
              size="large"
            >
              Найти товар
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Информация о товаре */}
      {productData && (
        <>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={3}>
                  {productData.product.images && productData.product.images.length > 0 && (
                    <Box
                      component="img"
                      src={productData.product.images[0]}
                      alt={productData.product.name}
                      sx={{
                        width: '100%',
                        maxWidth: 200,
                        height: 'auto',
                        borderRadius: 1,
                        objectFit: 'contain',
                      }}
                    />
                  )}
                </Grid>
                <Grid item xs={12} sm={9}>
                  <Typography variant="h5" component="h2" gutterBottom>
                    {productData.product.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    <strong>Артикул:</strong> {productData.product.vendorCode}
                  </Typography>
                  {productData.product.category && (
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      <strong>Категория:</strong> {productData.product.category}
                    </Typography>
                  )}
                  {productData.product.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {productData.product.description}
                    </Typography>
                  )}
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Список бизнесов */}
          <Paper sx={{ mb: 3 }}>
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="h6" component="h3">
                Этот товар есть в бизнесах:
              </Typography>
            </Box>
            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Бизнес</strong></TableCell>
                    <TableCell><strong>Offer ID</strong></TableCell>
                    <TableCell><strong>SKU</strong></TableCell>
                    <TableCell align="right"><strong>Текущая цена</strong></TableCell>
                    <TableCell align="right"><strong>Остаток</strong></TableCell>
                    <TableCell><strong>Статус</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {productData.businesses.map((business, index) => (
                    <TableRow key={index}>
                      <TableCell>{business.businessName}</TableCell>
                      <TableCell>{business.offerId}</TableCell>
                      <TableCell>{business.sku || '-'}</TableCell>
                      <TableCell align="right">
                        <Typography variant="body1" fontWeight="bold">
                          {business.price.toLocaleString('ru-RU')} ₽
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Chip
                          label={`${business.stock.available}${business.stock.reserved ? ` (+${business.stock.reserved} рез.)` : ''}`}
                          color={business.stock.available > 0 ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={business.status || 'Неизвестно'}
                          color={business.status === 'PUBLISHED' ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          {/* Обновление цены */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" component="h3" gutterBottom>
              Обновить цену во всех магазинах
            </Typography>
            <Grid container spacing={2} alignItems="center" sx={{ mt: 1 }}>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="Новая цена"
                  type="number"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">₽</InputAdornment>,
                  }}
                  helperText="Введите новую цену для всех бизнесов"
                />
              </Grid>
              <Grid item xs={12} sm={8}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleUpdatePrice}
                  disabled={updating || !newPrice.trim() || parseFloat(newPrice) <= 0}
                  startIcon={updating ? <CircularProgress size={20} /> : <UpdateIcon />}
                  size="large"
                  fullWidth={isMobile}
                >
                  {updating ? 'Обновление...' : 'Обновить во всех магазинах'}
                </Button>
              </Grid>
            </Grid>

            {/* Результаты обновления */}
            {updateResults.length > 0 && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Результаты обновления:
                </Typography>
                {updateResults.map((result, index) => (
                  <Alert
                    key={index}
                    severity={result.success ? 'success' : 'error'}
                    icon={result.success ? <CheckCircleIcon /> : <ErrorIcon />}
                    sx={{ mt: 1 }}
                  >
                    <strong>{result.businessName}</strong> ({result.businessId}):{' '}
                    {result.success ? 'Цена успешно обновлена' : `Ошибка: ${result.error}`}
                  </Alert>
                ))}
              </Box>
            )}
          </Paper>
        </>
      )}

      {/* Сообщение, если товар не найден */}
      {!productData && !loading && searchTerm && (
        <Paper sx={{ p: 4, textAlign: 'center', mt: 2 }}>
          <Typography variant="h6" gutterBottom>
            Товар не найден
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Проверьте правильность артикула или выполните синхронизацию товаров
          </Typography>
        </Paper>
      )}
      
      {!productData && !loading && !searchTerm && (
        <Paper sx={{ p: 4, textAlign: 'center', mt: 2 }}>
          <Typography variant="h6" gutterBottom>
            Управление ценами
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Введите артикул товара для поиска и управления ценами во всех бизнесах
          </Typography>
        </Paper>
      )}
    </Box>
  );
};

export default YandexPriceControl;

