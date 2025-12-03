import React, { useState, useEffect, useRef } from 'react';
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
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Switch,
  FormControlLabel,
  Alert,
  Chip,
  useMediaQuery,
  CircularProgress,
  LinearProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Refresh as RefreshIcon,
  Inventory as InventoryIcon,
  Sync as SyncIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useThemeContext } from '../contexts/ThemeContext';
import toast from 'react-hot-toast';

interface Business {
  _id: string;
  businessId: string;
  name: string;
  enabled: boolean;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: string;
  lastSyncAt?: string;
  createdAt: string;
  updatedAt: string;
}

const YandexBusinesses: React.FC = () => {
  const navigate = useNavigate();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [editingBusiness, setEditingBusiness] = useState<Business | null>(null);
  const [deletingBusiness, setDeletingBusiness] = useState<Business | null>(null);
  const [testingBusiness, setTestingBusiness] = useState<Business | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number; stage?: string } | null>(null);
  const syncProgressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  const [formData, setFormData] = useState({
    businessId: '',
    name: '',
    accessToken: '',
    refreshToken: '',
    tokenExpiresAt: '',
    enabled: true,
  });

  const { theme } = useThemeContext();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  useEffect(() => {
    fetchBusinesses();
    
    // Очистка интервала при размонтировании
    return () => {
      if (syncProgressIntervalRef.current) {
        clearInterval(syncProgressIntervalRef.current);
        syncProgressIntervalRef.current = null;
      }
    };
  }, []);

  const fetchBusinesses = async () => {
    try {
      setLoading(true);
      const response = await api.get('/yandex-market/businesses');
      // Обрабатываем разные форматы ответа
      let businessesList: Business[] = [];
      if (Array.isArray(response.data)) {
        businessesList = response.data;
      } else if (response.data?.businesses && Array.isArray(response.data.businesses)) {
        businessesList = response.data.businesses;
      } else if (response.data) {
        businessesList = [response.data];
      }
      setBusinesses(businessesList);
    } catch (error: any) {
      console.error('Ошибка загрузки бизнесов:', error);
      toast.error('Ошибка загрузки бизнесов');
      setBusinesses([]); // Устанавливаем пустой массив при ошибке
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (business?: Business) => {
      if (business) {
      setEditingBusiness(business);
      setFormData({
        businessId: business.businessId,
        name: business.name,
        accessToken: business.accessToken || '',
        refreshToken: business.refreshToken || '',
        tokenExpiresAt: business.tokenExpiresAt || '',
        enabled: business.enabled,
      });
    } else {
      setEditingBusiness(null);
      setFormData({
        businessId: '',
        name: '',
        accessToken: '',
        refreshToken: '',
        tokenExpiresAt: '',
        enabled: true,
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingBusiness(null);
    setFormData({
      businessId: '',
      name: '',
      accessToken: '',
      refreshToken: '',
      tokenExpiresAt: '',
      enabled: true,
    });
  };

  const handleSave = async () => {
    try {
      if (!formData.businessId || !formData.name || !formData.accessToken) {
        toast.error('Заполните обязательные поля: Business ID, Название, Access Token');
        return;
      }

      if (editingBusiness) {
        await api.put(`/yandex-market/businesses/${editingBusiness._id}`, formData);
        toast.success('Бизнес обновлен');
      } else {
        await api.post('/yandex-market/businesses', formData);
        toast.success('Бизнес создан');
      }

      handleCloseDialog();
      fetchBusinesses();
    } catch (error: any) {
      console.error('Ошибка сохранения бизнеса:', error);
      toast.error(error.response?.data?.message || 'Ошибка сохранения бизнеса');
    }
  };

  const handleDelete = async () => {
    if (!deletingBusiness) return;

    try {
      await api.delete(`/yandex-market/businesses/${deletingBusiness._id}`);
      toast.success('Бизнес удален');
      setDeleteDialogOpen(false);
      setDeletingBusiness(null);
      fetchBusinesses();
    } catch (error: any) {
      console.error('Ошибка удаления бизнеса:', error);
      toast.error(error.response?.data?.message || 'Ошибка удаления бизнеса');
    }
  };

  const handleTest = async () => {
    if (!testingBusiness) return;

    try {
      setTesting(true);
      setTestResult(null);
      // Добавляем таймаут 15 секунд для теста
      const response = await api.post(`/yandex-market/businesses/${testingBusiness._id}/test`, {}, {
        timeout: 15000
      });
      setTestResult({
        success: response.data.success,
        message: response.data.message || 'Тест выполнен',
      });
      if (response.data.success) {
        toast.success(`Подключение успешно! Найдено офферов: ${response.data.offersCount || 0}`);
      } else {
        toast.error('Ошибка подключения');
      }
    } catch (error: any) {
      console.error('Ошибка тестирования:', error);
      setTestResult({
        success: false,
        message: error.response?.data?.message || 'Ошибка подключения',
      });
      toast.error('Ошибка подключения');
    } finally {
      setTesting(false);
    }
  };

  const handleSyncProducts = async () => {
    try {
      setSyncing(true);
      setSyncProgress({ current: 0, total: 0, stage: 'Запуск синхронизации...' });
      
      // Запускаем синхронизацию без лимита (или с большим лимитом)
      // Если нужно ограничить, можно передать maxOffers в query параметрах
      await api.post('/yandex-market-go/sync/products');
      
      toast.success('Синхронизация запущена');
      
      // Очищаем предыдущий интервал, если есть
      if (syncProgressIntervalRef.current) {
        clearInterval(syncProgressIntervalRef.current);
      }

      // Опрашиваем прогресс
      syncProgressIntervalRef.current = setInterval(async () => {
        try {
          const progressResponse = await api.get('/yandex-market-go/sync/progress');
          
          if (progressResponse.data) {
            if (progressResponse.data.status === 'processing') {
              setSyncProgress({
                current: progressResponse.data.progress?.current || 0,
                total: progressResponse.data.progress?.total || 0,
                stage: progressResponse.data.progress?.stage || 'Синхронизация...',
              });
            } else if (progressResponse.data.status === 'completed') {
              if (syncProgressIntervalRef.current) {
                clearInterval(syncProgressIntervalRef.current);
                syncProgressIntervalRef.current = null;
              }
              setSyncing(false);
              setSyncProgress(null);
              const result = progressResponse.data.result;
              toast.success(
                `Синхронизация завершена! Синхронизировано товаров: ${result?.synced || 0} из ${result?.total || 0}`
              );
              fetchBusinesses(); // Обновляем список бизнесов
            } else if (progressResponse.data.status === 'error') {
              if (syncProgressIntervalRef.current) {
                clearInterval(syncProgressIntervalRef.current);
                syncProgressIntervalRef.current = null;
              }
              setSyncing(false);
              setSyncProgress(null);
              toast.error(progressResponse.data.error || 'Ошибка синхронизации');
            }
          }
        } catch (error: any) {
          console.error('Ошибка проверки прогресса:', error);
        }
      }, 2000); // Проверяем каждые 2 секунды

      // Останавливаем опрос через 10 минут (на случай зависания)
      setTimeout(() => {
        if (syncProgressIntervalRef.current) {
          clearInterval(syncProgressIntervalRef.current);
          syncProgressIntervalRef.current = null;
        }
        if (syncing) {
          setSyncing(false);
          setSyncProgress(null);
        }
      }, 600000);
    } catch (error: any) {
      console.error('Ошибка синхронизации:', error);
      toast.error(error.response?.data?.message || 'Ошибка запуска синхронизации');
      setSyncing(false);
      setSyncProgress(null);
    }
  };

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
          Управление бизнесами Яндекс Маркет
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            startIcon={syncing ? <CircularProgress size={20} /> : <SyncIcon />}
            onClick={handleSyncProducts}
            disabled={syncing || !Array.isArray(businesses) || businesses.filter(b => b.enabled).length === 0}
            size={isMobile ? 'large' : 'medium'}
          >
            {syncing ? 'Синхронизация...' : 'Синхронизировать товары'}
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
            size={isMobile ? 'large' : 'medium'}
          >
            Добавить бизнес
          </Button>
        </Box>
      </Box>

      {syncing && syncProgress && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {syncProgress.stage || 'Синхронизация товаров...'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {syncProgress.total > 0 
                ? `${syncProgress.current} / ${syncProgress.total}`
                : 'Запуск синхронизации...'}
            </Typography>
          </Box>
          {syncProgress.total > 0 && (
            <Box sx={{ width: '100%', mt: 1 }}>
              <LinearProgress
                variant="determinate"
                value={(syncProgress.current / syncProgress.total) * 100}
                sx={{ height: 8, borderRadius: 4 }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                {Math.round((syncProgress.current / syncProgress.total) * 100)}%
              </Typography>
            </Box>
          )}
        </Paper>
      )}

      {!Array.isArray(businesses) || businesses.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" gutterBottom>
            Нет добавленных бизнесов
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Добавьте бизнес для начала работы с Яндекс Маркет Partner API
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Добавить бизнес
          </Button>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>Название</strong></TableCell>
                <TableCell><strong>Business ID</strong></TableCell>
                <TableCell><strong>Статус</strong></TableCell>
                <TableCell><strong>Последняя синхронизация</strong></TableCell>
                <TableCell align="right"><strong>Действия</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {businesses.map((business) => (
                <TableRow key={business._id}>
                  <TableCell>{business.name}</TableCell>
                  <TableCell>{business.businessId}</TableCell>
                  <TableCell>
                    <Chip
                      label={business.enabled ? 'Включен' : 'Выключен'}
                      color={business.enabled ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {business.lastSyncAt
                      ? new Date(business.lastSyncAt).toLocaleString('ru-RU')
                      : 'Никогда'}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => navigate(`/yandex-market/businesses/${business.businessId}/products`)}
                      color="primary"
                      title="Товары бизнеса"
                    >
                      <InventoryIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => {
                        setTestingBusiness(business);
                        setTestResult(null);
                        setTestDialogOpen(true);
                      }}
                      color="primary"
                      title="Тест подключения"
                    >
                      <RefreshIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleOpenDialog(business)}
                      color="primary"
                      title="Редактировать"
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => {
                        setDeletingBusiness(business);
                        setDeleteDialogOpen(true);
                      }}
                      color="error"
                      title="Удалить"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Диалог создания/редактирования */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingBusiness ? 'Редактировать бизнес' : 'Добавить бизнес'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Business ID *"
              value={formData.businessId}
              onChange={(e) => setFormData({ ...formData, businessId: e.target.value })}
              fullWidth
              required
              disabled={!!editingBusiness}
              helperText="ID бизнеса из Яндекс Маркета"
            />
            <TextField
              label="Название *"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Access Token (Api-Key) *"
              value={formData.accessToken}
              onChange={(e) => setFormData({ ...formData, accessToken: e.target.value })}
              fullWidth
              required
              type="password"
              helperText="Api-Key для доступа к Market Yandex Go API (используется как accessToken)"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={formData.enabled}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                />
              }
              label="Включен для синхронизации"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Отмена</Button>
          <Button onClick={handleSave} variant="contained">
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог удаления */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Удалить бизнес?</DialogTitle>
        <DialogContent>
          <Typography>
            Вы уверены, что хотите удалить бизнес "{deletingBusiness?.name}"?
            Это действие нельзя отменить.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Отмена</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Удалить
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог тестирования */}
      <Dialog open={testDialogOpen} onClose={() => setTestDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Тест подключения</DialogTitle>
        <DialogContent>
          <Typography variant="body2" gutterBottom>
            Бизнес: <strong>{testingBusiness?.name}</strong> ({testingBusiness?.businessId})
          </Typography>
          {testResult && (
            <Alert
              severity={testResult.success ? 'success' : 'error'}
              icon={testResult.success ? <CheckCircleIcon /> : <CancelIcon />}
              sx={{ mt: 2 }}
            >
              {testResult.message}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTestDialogOpen(false)}>Закрыть</Button>
          <Button
            onClick={handleTest}
            variant="contained"
            disabled={testing}
            startIcon={testing ? <CircularProgress size={20} /> : <RefreshIcon />}
          >
            {testing ? 'Тестирование...' : 'Тестировать'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default YandexBusinesses;

