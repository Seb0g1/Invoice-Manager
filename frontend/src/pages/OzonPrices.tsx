import React, { useState, useEffect } from 'react';
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
  IconButton,
  InputAdornment,
  useMediaQuery,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  Edit as EditIcon,
  Save as SaveIcon
} from '@mui/icons-material';
import api from '../services/api';
import { OzonProduct } from '../types';
import { useThemeContext } from '../contexts/ThemeContext';
import toast from 'react-hot-toast';

const OzonPrices: React.FC = () => {
  const { theme } = useThemeContext();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [products, setProducts] = useState<OzonProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingProduct, setEditingProduct] = useState<OzonProduct | null>(null);
  const [price, setPrice] = useState<string>('');
  const [oldPrice, setOldPrice] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await api.get('/ozon/products', { params: { limit: 100 } });
      setProducts(response.data.products);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Ошибка при загрузке товаров OZON');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (product: OzonProduct) => {
    setEditingProduct(product);
    setPrice(product.price.toString());
    setOldPrice(product.oldPrice?.toString() || '');
  };

  const handleSave = async () => {
    if (!editingProduct) return;

    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) {
      toast.error('Цена должна быть положительным числом');
      return;
    }

    try {
      setSaving(true);
      const prices = [{
        offer_id: editingProduct.offerId,
        price: priceNum.toFixed(2),
        old_price: oldPrice ? parseFloat(oldPrice).toFixed(2) : undefined,
      }];

      await api.post('/ozon/products/update-prices', { prices });
      toast.success('Цена обновлена');
      setEditingProduct(null);
      fetchProducts();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Ошибка при обновлении цены');
    } finally {
      setSaving(false);
    }
  };

  const filteredProducts = products.filter((product) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      product.name.toLowerCase().includes(searchLower) ||
      product.offerId.toLowerCase().includes(searchLower) ||
      (product.sku ? String(product.sku).toLowerCase().includes(searchLower) : false)
    );
  });

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2, md: 3 } }}>
      <Typography variant="h4" sx={{ fontSize: { xs: '1.5rem', sm: '2rem' }, mb: 3 }}>
        Обновить цены на товары OZON
      </Typography>

      <TextField
        fullWidth
        label="Поиск товара"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
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

      {loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      ) : (
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
                <TableCell>Название</TableCell>
                <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Offer ID</TableCell>
                <TableCell align="right">Текущая цена</TableCell>
                <TableCell align="right" sx={{ display: { xs: 'none', md: 'table-cell' } }}>Старая цена</TableCell>
                <TableCell align="center">Действия</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isMobile ? 3 : 5} align="center">
                    <Typography color="text.secondary">
                      Товары не найдены
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredProducts.map((product) => (
                  <TableRow key={product.productId} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {product.name}
                      </Typography>
                      {product.offerId && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'block', sm: 'none' } }}>
                          ID: {product.offerId}
                        </Typography>
                      )}
                      {product.oldPrice && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'block', md: 'none' } }}>
                          Старая: {product.oldPrice.toLocaleString('ru-RU')} ₽
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>{product.offerId}</TableCell>
                    <TableCell align="right">
                      {product.price.toLocaleString('ru-RU')} ₽
                    </TableCell>
                    <TableCell align="right" sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                      {product.oldPrice ? `${product.oldPrice.toLocaleString('ru-RU')} ₽` : '-'}
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        size={isMobile ? "medium" : "small"}
                        onClick={() => handleEdit(product)}
                        sx={{ 
                          minWidth: { xs: 44, sm: 44 }, 
                          minHeight: { xs: 44, sm: 44 } 
                        }}
                      >
                        <EditIcon fontSize={isMobile ? "medium" : "small"} />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog
        open={!!editingProduct}
        onClose={() => setEditingProduct(null)}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>Обновить цену товара</DialogTitle>
        <DialogContent>
          {editingProduct && (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {editingProduct.name}
              </Typography>
              <TextField
                fullWidth
                label="Новая цена"
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                margin="normal"
                required
                InputProps={{
                  endAdornment: <InputAdornment position="end">₽</InputAdornment>
                }}
                size={isMobile ? "small" : "medium"}
              />
              <TextField
                fullWidth
                label="Старая цена (необязательно)"
                type="number"
                value={oldPrice}
                onChange={(e) => setOldPrice(e.target.value)}
                margin="normal"
                InputProps={{
                  endAdornment: <InputAdornment position="end">₽</InputAdornment>
                }}
                size={isMobile ? "small" : "medium"}
                helperText="Укажите 0, чтобы сбросить старую цену"
              />
              <Alert severity="info" sx={{ mt: 2 }}>
                Цену каждого товара можно обновлять не больше 10 раз в час.
              </Alert>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingProduct(null)} disabled={saving} size={isMobile ? "large" : "medium"}>
            Отмена
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={saving}
            startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
            size={isMobile ? "large" : "medium"}
          >
            {saving ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default OzonPrices;

