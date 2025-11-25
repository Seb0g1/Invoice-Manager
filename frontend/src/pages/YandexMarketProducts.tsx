import React, { useState, useEffect, useMemo } from 'react';
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
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  Refresh as RefreshIcon,
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

const YandexMarketProducts: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [itemsPerPage] = useState(50);
  const { theme, mode } = useThemeContext();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  useEffect(() => {
    fetchProducts();
  }, []);

  // Перезагружаем при изменении поиска с задержкой
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProducts();
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      // Загружаем все товары через поиск с пустым запросом (или можно создать отдельный endpoint)
      const response = await api.get('/yandex-market/products/search', {
        params: { q: '', limit: 1000 },
      });
      
      if (response.data.products) {
        // Для каждого товара загружаем полную информацию с бизнесами
        const productsWithBusinesses = await Promise.all(
          response.data.products.slice(0, 100).map(async (product: any) => {
            try {
              const productResponse = await api.get(`/yandex-market/products/${product.vendorCode}`);
              return productResponse.data;
            } catch (error) {
              return null;
            }
          })
        );
        
        setProducts(productsWithBusinesses.filter((p: any) => p !== null));
      }
    } catch (error: any) {
      console.error('Ошибка загрузки товаров:', error);
      toast.error('Ошибка загрузки товаров');
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      if (!searchTerm) return true;
      const searchLower = searchTerm.toLowerCase();
      return (
        product.vendorCode.toLowerCase().includes(searchLower) ||
        product.name.toLowerCase().includes(searchLower)
      );
    });
  }, [products, searchTerm]);

  const paginatedProducts = useMemo(() => {
    const startIndex = (page - 1) * itemsPerPage;
    return filteredProducts.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredProducts, page, itemsPerPage]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
          Товары Яндекс Маркет
        </Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={fetchProducts}
          size={isMobile ? 'large' : 'medium'}
        >
          Обновить
        </Button>
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

      {/* Статистика */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <Typography variant="body2" color="text.secondary">
              Всего товаров
            </Typography>
            <Typography variant="h5" fontWeight="bold">
              {filteredProducts.length}
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
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      В бизнесах ({product.businesses.length}):
                    </Typography>
                    {product.businesses.map((business, idx) => (
                      <Box key={idx} sx={{ mb: 1, p: 1, bgcolor: 'background.default', borderRadius: 1 }}>
                        <Typography variant="body2" fontWeight="bold">
                          {business.businessName}
                        </Typography>
                        <Typography variant="body2">
                          Цена: {business.price.toLocaleString('ru-RU')} ₽
                        </Typography>
                        <Chip
                          label={`Остаток: ${business.stock.available}${business.stock.reserved ? ` (+${business.stock.reserved} рез.)` : ''}`}
                          color={business.stock.available > 0 ? 'success' : 'default'}
                          size="small"
                          sx={{ mt: 0.5 }}
                        />
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
                <TableCell><strong>Бизнесы</strong></TableCell>
                <TableCell align="right"><strong>Цены</strong></TableCell>
                <TableCell align="right"><strong>Остатки</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedProducts.map((product) => (
                <TableRow key={product.id}>
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
                        <Typography key={idx} variant="body2">
                          {business.price.toLocaleString('ru-RU')} ₽
                        </Typography>
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

      {filteredProducts.length === 0 && (
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

