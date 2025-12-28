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
  useMediaQuery,
  Tabs,
  Tab,
  InputAdornment,
  IconButton,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Pagination,
  Grid
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  TrendingUp as TrendingUpIcon
} from '@mui/icons-material';
import api from '../services/api';
import { useThemeContext } from '../contexts/ThemeContext';
import toast from 'react-hot-toast';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ru } from 'date-fns/locale';
import { format } from 'date-fns';

const OzonSearchQueries: React.FC = () => {
  const { theme } = useThemeContext();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [tab, setTab] = useState(0);

  // Поиск по тексту
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<any>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchSortBy, setSearchSortBy] = useState<'SORT_BY_UNSPECIFIED' | 'CLIENT_COUNT' | 'ADD_TO_CART' | 'CONVERSION_TO_CART' | 'AVG_PRICE'>('CLIENT_COUNT');
  const [searchSortDir, setSearchSortDir] = useState<'ASC' | 'DESC'>('DESC');
  const [searchPage] = useState(0);

  // Популярные запросы
  const [topQueries, setTopQueries] = useState<any>(null);
  const [topLoading, setTopLoading] = useState(false);
  const [topPage, setTopPage] = useState(0);

  // Запросы товаров
  const [productQueriesDateFrom, setProductQueriesDateFrom] = useState<Date | null>(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const [productQueriesDateTo, setProductQueriesDateTo] = useState<Date | null>(new Date());
  const [productSkus, setProductSkus] = useState<string>('');
  const [productQueries, setProductQueries] = useState<any>(null);
  const [productQueriesLoading, setProductQueriesLoading] = useState(false);
  const [productQueriesSortBy, setProductQueriesSortBy] = useState<'BY_SEARCHES' | 'BY_VIEWS' | 'BY_POSITION' | 'BY_CONVERSION' | 'BY_GMV'>('BY_SEARCHES');
  const [productQueriesSortDir, setProductQueriesSortDir] = useState<'DESCENDING' | 'ASCENDING'>('DESCENDING');

  const handleSearchByText = async () => {
    if (!searchText.trim()) {
      toast.error('Введите текст для поиска');
      return;
    }

    try {
      setSearchLoading(true);
      const response = await api.post('/ozon/search-queries/text', {
        text: searchText.trim(),
        limit: 50,
        offset: searchPage * 50,
        sortBy: searchSortBy,
        sortDir: searchSortDir,
      });

      setSearchResults(response.data);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Ошибка при поиске запросов');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleFetchTopQueries = async () => {
    try {
      setTopLoading(true);
      const response = await api.get('/ozon/search-queries/top', {
        params: {
          limit: 50,
          offset: topPage * 50,
        },
      });

      setTopQueries(response.data);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Ошибка при загрузке популярных запросов');
    } finally {
      setTopLoading(false);
    }
  };

  const handleFetchProductQueries = async () => {
    if (!productQueriesDateFrom || !productSkus.trim()) {
      toast.error('Выберите дату начала и введите SKU товаров');
      return;
    }

    const skusArray = productSkus.split(',').map(s => s.trim()).filter(s => s);
    if (skusArray.length === 0) {
      toast.error('Введите хотя бы один SKU');
      return;
    }

    try {
      setProductQueriesLoading(true);
      const response = await api.post('/ozon/analytics/product-queries', {
        dateFrom: format(productQueriesDateFrom, "yyyy-MM-dd'T'HH:mm:ss'Z'"),
        dateTo: productQueriesDateTo ? format(productQueriesDateTo, "yyyy-MM-dd'T'HH:mm:ss'Z'") : undefined,
        skus: skusArray,
        pageSize: 1000,
        page: 0,
        sortBy: productQueriesSortBy,
        sortDir: productQueriesSortDir,
      });

      setProductQueries(response.data);
      toast.success('Запросы товаров загружены');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Ошибка при загрузке запросов товаров');
    } finally {
      setProductQueriesLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 1) {
      handleFetchTopQueries();
    }
  }, [topPage]);

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ru}>
      <Box sx={{ p: { xs: 1.5, sm: 2, md: 3 } }}>
        <Typography variant="h4" sx={{ fontSize: { xs: '1.5rem', sm: '2rem' }, mb: 3 }}>
          Поисковые запросы OZON
        </Typography>

        <Paper sx={{ mb: 3 }}>
          <Tabs value={tab} onChange={(_e, newValue) => setTab(newValue)}>
            <Tab label="Поиск по тексту" />
            <Tab label="Популярные запросы" />
            <Tab label="Запросы товаров" />
          </Tabs>
        </Paper>

        {/* Поиск по тексту */}
        {tab === 0 && (
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
              <TextField
                fullWidth
                label="Текст поиска"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearchByText()}
                size="small"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                  endAdornment: searchText && (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setSearchText('')} edge="end" size="small">
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
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Сортировка</InputLabel>
                <Select
                  value={searchSortBy}
                  onChange={(e) => setSearchSortBy(e.target.value as any)}
                >
                  <MenuItem value="CLIENT_COUNT">Популярность</MenuItem>
                  <MenuItem value="ADD_TO_CART">В корзину</MenuItem>
                  <MenuItem value="CONVERSION_TO_CART">Конверсия</MenuItem>
                  <MenuItem value="AVG_PRICE">Средняя цена</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Направление</InputLabel>
                <Select
                  value={searchSortDir}
                  onChange={(e) => setSearchSortDir(e.target.value as any)}
                >
                  <MenuItem value="DESC">По убыванию</MenuItem>
                  <MenuItem value="ASC">По возрастанию</MenuItem>
                </Select>
              </FormControl>
              <Button
                variant="contained"
                onClick={handleSearchByText}
                disabled={searchLoading}
                startIcon={searchLoading ? <CircularProgress size={20} /> : <SearchIcon />}
                size={isMobile ? "large" : "medium"}
                sx={{ minHeight: { xs: 44, sm: 'auto' } }}
              >
                Поиск
              </Button>
            </Box>

            {searchResults && (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Всего найдено: {searchResults.total || 0}
                </Typography>
                {searchResults.search_queries && searchResults.search_queries.length > 0 ? (
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
                          <TableCell>Запрос</TableCell>
                          <TableCell align="right">Популярность</TableCell>
                          <TableCell align="right">В корзину</TableCell>
                          <TableCell align="right">Конверсия</TableCell>
                          <TableCell align="right">Средняя цена</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {searchResults.search_queries.map((query: any, index: number) => (
                          <TableRow key={index}>
                            <TableCell>{query.query}</TableCell>
                            <TableCell align="right">{query.client_count?.toLocaleString('ru-RU') || '-'}</TableCell>
                            <TableCell align="right">{query.add_to_cart?.toLocaleString('ru-RU') || '-'}</TableCell>
                            <TableCell align="right">
                              {query.conversion_to_cart ? `${(query.conversion_to_cart * 100).toFixed(2)}%` : '-'}
                            </TableCell>
                            <TableCell align="right">
                              {query.avg_price ? `${query.avg_price.toLocaleString('ru-RU')} ₽` : '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                    Запросы не найдены
                  </Typography>
                )}
              </>
            )}
          </Paper>
        )}

        {/* Популярные запросы */}
        {tab === 1 && (
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6">Популярные поисковые запросы</Typography>
              <Button
                variant="outlined"
                onClick={handleFetchTopQueries}
                disabled={topLoading}
                startIcon={topLoading ? <CircularProgress size={20} /> : <TrendingUpIcon />}
                size={isMobile ? "large" : "medium"}
              >
                Обновить
              </Button>
            </Box>

            {topQueries && (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Всего: {topQueries.total || 0}
                </Typography>
                {topQueries.search_queries && topQueries.search_queries.length > 0 ? (
                  <>
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
                            <TableCell>Запрос</TableCell>
                            <TableCell align="right">Популярность</TableCell>
                            <TableCell align="right">В корзину</TableCell>
                            <TableCell align="right">Конверсия</TableCell>
                            <TableCell align="right">Средняя цена</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {topQueries.search_queries.map((query: any, index: number) => (
                            <TableRow key={index}>
                              <TableCell>{query.query}</TableCell>
                              <TableCell align="right">{query.client_count?.toLocaleString('ru-RU') || '-'}</TableCell>
                              <TableCell align="right">{query.add_to_cart?.toLocaleString('ru-RU') || '-'}</TableCell>
                              <TableCell align="right">
                                {query.conversion_to_cart ? `${(query.conversion_to_cart * 100).toFixed(2)}%` : '-'}
                              </TableCell>
                              <TableCell align="right">
                                {query.avg_price ? `${query.avg_price.toLocaleString('ru-RU')} ₽` : '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                      <Pagination
                        count={Math.ceil((topQueries.total || 0) / 50)}
                        page={topPage + 1}
                        onChange={(_e, page) => setTopPage(page - 1)}
                        color="primary"
                      />
                    </Box>
                  </>
                ) : (
                  <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                    Запросы не найдены
                  </Typography>
                )}
              </>
            )}
          </Paper>
        )}

        {/* Запросы товаров */}
        {tab === 2 && (
          <Paper sx={{ p: 3 }}>
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6}>
                <DatePicker
                  label="Дата начала"
                  value={productQueriesDateFrom}
                  onChange={(newValue) => setProductQueriesDateFrom(newValue)}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      size: isMobile ? "small" : "medium",
                    }
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <DatePicker
                  label="Дата окончания"
                  value={productQueriesDateTo}
                  onChange={(newValue) => setProductQueriesDateTo(newValue)}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      size: isMobile ? "small" : "medium",
                    }
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="SKU товаров (через запятую)"
                  value={productSkus}
                  onChange={(e) => setProductSkus(e.target.value)}
                  size="small"
                  helperText="Введите SKU товаров через запятую (максимум 1000)"
                  inputProps={{
                    style: { textTransform: 'none' }
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Сортировка</InputLabel>
                  <Select
                    value={productQueriesSortBy}
                    onChange={(e) => setProductQueriesSortBy(e.target.value as any)}
                  >
                    <MenuItem value="BY_SEARCHES">По запросам</MenuItem>
                    <MenuItem value="BY_VIEWS">По просмотрам</MenuItem>
                    <MenuItem value="BY_POSITION">По позиции</MenuItem>
                    <MenuItem value="BY_CONVERSION">По конверсии</MenuItem>
                    <MenuItem value="BY_GMV">По объёму продаж</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Направление</InputLabel>
                  <Select
                    value={productQueriesSortDir}
                    onChange={(e) => setProductQueriesSortDir(e.target.value as any)}
                  >
                    <MenuItem value="DESCENDING">По убыванию</MenuItem>
                    <MenuItem value="ASCENDING">По возрастанию</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <Button
                  variant="contained"
                  onClick={handleFetchProductQueries}
                  disabled={productQueriesLoading}
                  startIcon={productQueriesLoading ? <CircularProgress size={20} /> : <SearchIcon />}
                  size={isMobile ? "large" : "medium"}
                  fullWidth={isMobile}
                  sx={{ minHeight: { xs: 44, sm: 'auto' } }}
                >
                  {productQueriesLoading ? 'Загрузка...' : 'Загрузить запросы товаров'}
                </Button>
              </Grid>
            </Grid>

            {productQueries && (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Всего запросов: {productQueries.total || 0}
                </Typography>
                {productQueries.items && productQueries.items.length > 0 ? (
                  <TableContainer
                    component={Paper}
                    sx={{
                      overflowX: 'auto',
                      '& .MuiTable-root': {
                        minWidth: { xs: 500, sm: 700 },
                      }
                    }}
                  >
                    <Table size={isMobile ? "small" : "medium"}>
                      <TableHead>
                        <TableRow>
                          <TableCell>Товар</TableCell>
                          <TableCell>SKU</TableCell>
                          <TableCell align="right">Позиция</TableCell>
                          <TableCell align="right">Просмотры</TableCell>
                          <TableCell align="right">Конверсия</TableCell>
                          <TableCell align="right">Объём продаж</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {productQueries.items.map((item: any, index: number) => (
                          <TableRow key={index}>
                            <TableCell>{item.name || '-'}</TableCell>
                            <TableCell>{item.sku || '-'}</TableCell>
                            <TableCell align="right">{item.position?.toFixed(2) || '-'}</TableCell>
                            <TableCell align="right">{item.unique_view_users?.toLocaleString('ru-RU') || '-'}</TableCell>
                            <TableCell align="right">
                              {item.view_conversion ? `${(item.view_conversion * 100).toFixed(2)}%` : '-'}
                            </TableCell>
                            <TableCell align="right">
                              {item.gmv ? `${item.gmv.toLocaleString('ru-RU')} ${item.currency || '₽'}` : '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                    Запросы не найдены
                  </Typography>
                )}
              </>
            )}
          </Paper>
        )}
      </Box>
    </LocalizationProvider>
  );
};

export default OzonSearchQueries;

