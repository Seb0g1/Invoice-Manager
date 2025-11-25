import React, { useState, useEffect } from 'react';
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
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
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
  
  const [formData, setFormData] = useState({
    businessId: '',
    name: '',
    accessToken: '',
    enabled: true,
  });

  const { theme } = useThemeContext();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  useEffect(() => {
    fetchBusinesses();
  }, []);

  const fetchBusinesses = async () => {
    try {
      setLoading(true);
      const response = await api.get('/yandex-market/businesses');
      setBusinesses(response.data || []);
    } catch (error: any) {
      console.error('Ошибка загрузки бизнесов:', error);
      toast.error('Ошибка загрузки бизнесов');
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
        enabled: business.enabled,
      });
    } else {
      setEditingBusiness(null);
      setFormData({
        businessId: '',
        name: '',
        accessToken: '',
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
      const response = await api.post(`/yandex-market/businesses/${testingBusiness._id}/test`);
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

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
          Управление бизнесами Яндекс Маркет
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
          size={isMobile ? 'large' : 'medium'}
        >
          Добавить бизнес
        </Button>
      </Box>

      {businesses.length === 0 ? (
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

