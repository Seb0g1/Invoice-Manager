import React, { useState, useEffect } from 'react';
import {
  Box, Paper, Typography, Button, TextField, Switch, FormControlLabel,
  Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress,
  Alert, Divider, Grid, useMediaQuery, ToggleButton, ToggleButtonGroup,
  InputAdornment, IconButton, Checkbox, FormGroup, Accordion, AccordionSummary,
  AccordionDetails, Chip
} from '@mui/material';
import {
  Settings as SettingsIcon, Send as SendIcon, Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon, DarkMode as DarkModeIcon,
  LightMode as LightModeIcon, AutoMode as AutoModeIcon,
  Sync as SyncIcon, ExpandMore as ExpandMoreIcon, Menu as MenuIcon,
  Security as SecurityIcon
} from '@mui/icons-material';
import api from '../services/api';
import { useThemeContext } from '../contexts/ThemeContext';
import toast from 'react-hot-toast';

interface SettingsData {
  theme: 'light' | 'dark' | 'auto';
  autoNightModeEnabled: boolean;
  nightModeStartTime: string;
  nightModeEndTime: string;
  telegramBotToken: string;
  telegramChatId: string;
  telegramTopics: {
    invoiceAdded?: string;
    pickingListItemCollected?: string;
    supplierBalanceChanged?: string;
  };
  telegramEnabled: boolean;
  sidebarEnabled: boolean;
  hiddenPages?: string[];
  rolePermissions?: {
    [role: string]: {
      visiblePages: string[];
      accessibleRoutes: string[];
    };
  };
  ozonClientId: string;
  ozonApiKey: string;
  ozonEnabled: boolean;
}

const ALL_PAGES = [
  { path: '/invoices', label: 'Накладные' },
  { path: '/picking-lists', label: 'Лист сборки' },
  { path: '/warehouse', label: 'Наш склад' },
  { path: '/yandex', label: 'Yandex Market' },
  { path: '/suppliers', label: 'Поставщики' },
  { path: '/users', label: 'Пользователи' },
  { path: '/settings', label: 'Настройки' },
  { path: '/ozon/products', label: 'OZON: Список товаров' },
  { path: '/ozon/prices', label: 'OZON: Обновить цены' },
  { path: '/ozon/chats', label: 'OZON: Чаты с покупателями' },
  { path: '/ozon/analytics', label: 'OZON: Аналитика' },
  { path: '/ozon/search-queries', label: 'OZON: Поисковые запросы' },
  { path: '/ozon/finance', label: 'OZON: Финансы' },
];

const ALL_ROLES = ['director', 'collector'];

const Settings: React.FC = () => {
  const { theme, mode, toggleTheme, setTheme } = useThemeContext();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [testingOzon, setTestingOzon] = useState(false);
  const [syncingOzon, setSyncingOzon] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number } | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [showOzonApiKey, setShowOzonApiKey] = useState(false);
  const [settings, setSettings] = useState<SettingsData>({
    theme: 'auto',
    autoNightModeEnabled: false,
    nightModeStartTime: '22:00',
    nightModeEndTime: '07:00',
    telegramBotToken: '',
    telegramChatId: '',
    telegramTopics: {},
    telegramEnabled: false,
    sidebarEnabled: true,
    hiddenPages: [],
    rolePermissions: {},
    ozonClientId: '',
    ozonApiKey: '',
    ozonEnabled: false,
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const [settingsResponse, ozonResponse] = await Promise.all([
        api.get('/settings'),
        api.get('/ozon/config').catch(() => ({ data: { clientId: '', apiKey: '', enabled: false } }))
      ]);
      
      const settingsData = {
        ...settingsResponse.data,
        sidebarEnabled: settingsResponse.data.sidebarEnabled !== undefined ? settingsResponse.data.sidebarEnabled : true,
        hiddenPages: settingsResponse.data.hiddenPages || [],
        rolePermissions: settingsResponse.data.rolePermissions || {},
        ozonClientId: ozonResponse.data.clientId || '',
        ozonApiKey: ozonResponse.data.apiKey || '',
        ozonEnabled: ozonResponse.data.enabled || false,
      };
      
      setSettings(settingsData);
      // Применяем тему, если она изменилась
      if (settingsData.theme !== mode) {
        setTheme(settingsData.theme);
      }
    } catch (error: any) {
      if (error.response?.status !== 404) {
        toast.error('Ошибка при загрузке настроек');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      // Сохраняем основные настройки
      const { ozonClientId, ozonApiKey, ozonEnabled, ...mainSettings } = settings;
      await api.put('/settings', mainSettings);
      
      // Сохраняем настройки OZON отдельно
      if (ozonClientId && ozonApiKey) {
        await api.put('/ozon/config', {
          clientId: ozonClientId,
          apiKey: ozonApiKey,
          enabled: ozonEnabled,
        });
      }
      
      toast.success('Настройки сохранены');
      // Применяем новую тему
      setTheme(settings.theme);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Ошибка при сохранении настроек');
    } finally {
      setSaving(false);
    }
  };

  const handleTestTelegram = async () => {
    if (!settings.telegramBotToken || !settings.telegramChatId) {
      toast.error('Заполните Bot Token и Chat ID для тестирования');
      return;
    }

    try {
      setTestingTelegram(true);
      const response = await api.post('/settings/telegram/test', {
        telegramBotToken: settings.telegramBotToken,
        telegramChatId: settings.telegramChatId,
      });
      
      if (response.data.success) {
        toast.success(`Подключение успешно! Бот: @${response.data.botName}`);
      } else {
        toast.error(response.data.message || 'Ошибка подключения');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Ошибка при тестировании подключения');
    } finally {
      setTestingTelegram(false);
    }
  };

  const handleTestOzon = async () => {
    if (!settings.ozonClientId || !settings.ozonApiKey) {
      toast.error('Заполните Client ID и API Key для тестирования');
      return;
    }

    try {
      setTestingOzon(true);
      const response = await api.post('/ozon/test', {
        clientId: settings.ozonClientId,
        apiKey: settings.ozonApiKey,
      });

      if (response.data.success) {
        toast.success('Подключение к OZON API успешно!');
      } else {
        toast.error(response.data.message || 'Ошибка подключения');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Ошибка при тестировании подключения к OZON');
    } finally {
      setTestingOzon(false);
    }
  };

  const handleSyncOzon = async () => {
    if (!settings.ozonClientId || !settings.ozonApiKey) {
      toast.error('Заполните Client ID и API Key для синхронизации');
      return;
    }

    try {
      setSyncingOzon(true);
      setSyncProgress({ current: 0, total: 0 });

      // Используем обычный запрос для синхронизации (EventSource требует специальной настройки на бэкенде)
      // Для простоты используем обычный запрос с периодическим обновлением
      const response = await api.get('/ozon/sync', {
        params: {
          clientId: settings.ozonClientId,
          apiKey: settings.ozonApiKey,
        },
      });

      if (response.data.complete) {
        toast.success(`Синхронизация завершена! Синхронизировано товаров: ${response.data.total || 0}`);
      }

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.progress) {
          setSyncProgress({
            current: data.progress.current || 0,
            total: data.progress.total || 0,
          });
        }
        if (data.complete) {
          eventSource.close();
          setSyncingOzon(false);
          setSyncProgress(null);
          toast.success(`Синхронизация завершена! Синхронизировано товаров: ${data.total || 0}`);
        }
        if (data.error) {
          eventSource.close();
          setSyncingOzon(false);
          setSyncProgress(null);
          toast.error(data.error || 'Ошибка при синхронизации');
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
        setSyncingOzon(false);
        setSyncProgress(null);
        toast.error('Ошибка при синхронизации');
      };
    } catch (error: any) {
      setSyncingOzon(false);
      setSyncProgress(null);
      toast.error(error.response?.data?.message || 'Ошибка при запуске синхронизации');
    }
  };

  const handleThemeChange = (_: React.MouseEvent<HTMLElement>, newTheme: 'light' | 'dark' | 'auto' | null) => {
    if (newTheme !== null) {
      setSettings({ ...settings, theme: newTheme });
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2, md: 3 } }}>
      <Typography variant="h4" sx={{ mb: 3, fontSize: { xs: '1.5rem', sm: '2rem' } }}>
        Настройки
      </Typography>

      <Grid container spacing={3}>
        {/* Настройки темы */}
        <Grid item xs={12}>
          <Paper
            sx={{
              p: 3,
              background: mode === 'dark'
                ? 'rgba(30, 30, 30, 0.9)'
                : 'rgba(255, 255, 255, 0.9)',
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              border: mode === 'dark'
                ? '1px solid rgba(255, 255, 255, 0.1)'
                : '1px solid rgba(0, 0, 0, 0.1)',
            }}
          >
            <Typography variant="h6" sx={{ mb: 2 }}>
              Тема оформления
            </Typography>
            <Box sx={{ mb: 2 }}>
              <ToggleButtonGroup
                value={settings.theme}
                exclusive
                onChange={handleThemeChange}
                aria-label="theme selection"
                fullWidth={isMobile}
                size={isMobile ? "large" : "medium"}
              >
                <ToggleButton value="light" aria-label="light">
                  <LightModeIcon sx={{ mr: 1 }} />
                  Светлая
                </ToggleButton>
                <ToggleButton value="dark" aria-label="dark">
                  <DarkModeIcon sx={{ mr: 1 }} />
                  Тёмная
                </ToggleButton>
                <ToggleButton value="auto" aria-label="auto">
                  <AutoModeIcon sx={{ mr: 1 }} />
                  Авто
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>

            <FormControlLabel
              control={
                <Switch
                  checked={settings.autoNightModeEnabled}
                  onChange={(e) => setSettings({ ...settings, autoNightModeEnabled: e.target.checked })}
                />
              }
              label="Автоматический ночной режим"
            />

            {settings.autoNightModeEnabled && (
              <Box sx={{ mt: 2, display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
                <TextField
                  label="Начало ночного режима (МСК)"
                  type="time"
                  value={settings.nightModeStartTime}
                  onChange={(e) => setSettings({ ...settings, nightModeStartTime: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                  size={isMobile ? "small" : "medium"}
                  fullWidth={isMobile}
                />
                <TextField
                  label="Конец ночного режима (МСК)"
                  type="time"
                  value={settings.nightModeEndTime}
                  onChange={(e) => setSettings({ ...settings, nightModeEndTime: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                  size={isMobile ? "small" : "medium"}
                  fullWidth={isMobile}
                />
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Настройки Telegram */}
        <Grid item xs={12}>
          <Paper
            sx={{
              p: 3,
              background: mode === 'dark'
                ? 'rgba(30, 30, 30, 0.9)'
                : 'rgba(255, 255, 255, 0.9)',
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              border: mode === 'dark'
                ? '1px solid rgba(255, 255, 255, 0.1)'
                : '1px solid rgba(0, 0, 0, 0.1)',
            }}
          >
            <Typography variant="h6" sx={{ mb: 2 }}>
              Telegram уведомления
            </Typography>

            <FormControlLabel
              control={
                <Switch
                  checked={settings.telegramEnabled}
                  onChange={(e) => setSettings({ ...settings, telegramEnabled: e.target.checked })}
                />
              }
              label="Включить Telegram уведомления"
              sx={{ mb: 2 }}
            />

            {settings.telegramEnabled && (
              <>
                <TextField
                  fullWidth
                  label="Bot Token"
                  type={showToken ? 'text' : 'password'}
                  value={settings.telegramBotToken}
                  onChange={(e) => setSettings({ ...settings, telegramBotToken: e.target.value })}
                  margin="normal"
                  size={isMobile ? "small" : "medium"}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowToken(!showToken)}
                          edge="end"
                        >
                          {showToken ? <VisibilityOffIcon /> : <VisibilityIcon />}
                        </IconButton>
                      </InputAdornment>
                    ),
                    style: { textTransform: 'none' }
                  }}
                  inputProps={{ style: { textTransform: 'none' } }}
                />

                <TextField
                  fullWidth
                  label="Chat ID"
                  value={settings.telegramChatId}
                  onChange={(e) => setSettings({ ...settings, telegramChatId: e.target.value })}
                  margin="normal"
                  size={isMobile ? "small" : "medium"}
                  helperText="ID чата или канала для уведомлений"
                  InputProps={{ style: { textTransform: 'none' } }}
                  inputProps={{ style: { textTransform: 'none' } }}
                />

                <Alert severity="info" sx={{ mt: 2, mb: 2 }}>
                  Для получения Chat ID используйте бота @userinfobot или создайте группу и добавьте бота.
                  Для топиков форума укажите ID топика в соответствующих полях ниже.
                </Alert>

                <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
                  ID топиков (необязательно):
                </Typography>

                <TextField
                  fullWidth
                  label="Топик: Накладные"
                  value={settings.telegramTopics.invoiceAdded || ''}
                  onChange={(e) => setSettings({
                    ...settings,
                    telegramTopics: {
                      ...settings.telegramTopics,
                      invoiceAdded: e.target.value,
                    },
                  })}
                  margin="normal"
                  size={isMobile ? "small" : "medium"}
                  InputProps={{ style: { textTransform: 'none' } }}
                  inputProps={{ style: { textTransform: 'none' } }}
                />

                <TextField
                  fullWidth
                  label="Топик: Лист сборки"
                  value={settings.telegramTopics.pickingListItemCollected || ''}
                  onChange={(e) => setSettings({
                    ...settings,
                    telegramTopics: {
                      ...settings.telegramTopics,
                      pickingListItemCollected: e.target.value,
                    },
                  })}
                  margin="normal"
                  size={isMobile ? "small" : "medium"}
                  InputProps={{ style: { textTransform: 'none' } }}
                  inputProps={{ style: { textTransform: 'none' } }}
                />

                <TextField
                  fullWidth
                  label="Топик: Баланс поставщика"
                  value={settings.telegramTopics.supplierBalanceChanged || ''}
                  onChange={(e) => setSettings({
                    ...settings,
                    telegramTopics: {
                      ...settings.telegramTopics,
                      supplierBalanceChanged: e.target.value,
                    },
                  })}
                  margin="normal"
                  size={isMobile ? "small" : "medium"}
                  InputProps={{ style: { textTransform: 'none' } }}
                  inputProps={{ style: { textTransform: 'none' } }}
                />

                <Button
                  variant="outlined"
                  startIcon={<SendIcon />}
                  onClick={handleTestTelegram}
                  disabled={testingTelegram || !settings.telegramBotToken || !settings.telegramChatId}
                  sx={{ mt: 2 }}
                  size={isMobile ? "large" : "medium"}
                  fullWidth={isMobile}
                >
                  {testingTelegram ? <CircularProgress size={24} /> : 'Тестировать подключение'}
                </Button>
              </>
            )}
          </Paper>
        </Grid>

        {/* Настройки OZON API */}
        <Grid item xs={12}>
          <Paper
            sx={{
              p: 3,
              background: mode === 'dark'
                ? 'rgba(30, 30, 30, 0.9)'
                : 'rgba(255, 255, 255, 0.9)',
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              border: mode === 'dark'
                ? '1px solid rgba(255, 255, 255, 0.1)'
                : '1px solid rgba(0, 0, 0, 0.1)',
            }}
          >
            <Typography variant="h6" sx={{ mb: 2 }}>
              OZON API
            </Typography>

            <FormControlLabel
              control={
                <Switch
                  checked={settings.ozonEnabled}
                  onChange={(e) => setSettings({ ...settings, ozonEnabled: e.target.checked })}
                />
              }
              label="Включить OZON API"
              sx={{ mb: 2 }}
            />

            {settings.ozonEnabled && (
              <>
                <TextField
                  fullWidth
                  label="Client ID"
                  value={settings.ozonClientId}
                  onChange={(e) => setSettings({ ...settings, ozonClientId: e.target.value })}
                  margin="normal"
                  size={isMobile ? "small" : "medium"}
                  InputProps={{ style: { textTransform: 'none' } }}
                  inputProps={{ style: { textTransform: 'none' } }}
                />

                <TextField
                  fullWidth
                  label="API Key"
                  type={showOzonApiKey ? 'text' : 'password'}
                  value={settings.ozonApiKey}
                  onChange={(e) => setSettings({ ...settings, ozonApiKey: e.target.value })}
                  margin="normal"
                  size={isMobile ? "small" : "medium"}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowOzonApiKey(!showOzonApiKey)}
                          edge="end"
                        >
                          {showOzonApiKey ? <VisibilityOffIcon /> : <VisibilityIcon />}
                        </IconButton>
                      </InputAdornment>
                    ),
                    style: { textTransform: 'none' }
                  }}
                  inputProps={{ style: { textTransform: 'none' } }}
                />

                <Alert severity="info" sx={{ mt: 2, mb: 2 }}>
                  Получите Client ID и API Key в личном кабинете Ozon Seller (Настройки → API интеграции → Seller API).
                </Alert>

                <Box sx={{ display: 'flex', gap: 2, mt: 2, flexWrap: 'wrap' }}>
                  <Button
                    variant="outlined"
                    startIcon={testingOzon ? <CircularProgress size={20} /> : <SendIcon />}
                    onClick={handleTestOzon}
                    disabled={testingOzon || syncingOzon || !settings.ozonClientId || !settings.ozonApiKey}
                    size={isMobile ? "large" : "medium"}
                    sx={{ minHeight: { xs: 44, sm: 'auto' }, flex: isMobile ? '1 1 100%' : '0 1 auto' }}
                  >
                    {testingOzon ? 'Тестирование...' : 'Тестировать подключение'}
                  </Button>

                  <Button
                    variant="contained"
                    startIcon={syncingOzon ? <CircularProgress size={20} /> : <SyncIcon />}
                    onClick={handleSyncOzon}
                    disabled={syncingOzon || testingOzon || !settings.ozonClientId || !settings.ozonApiKey}
                    size={isMobile ? "large" : "medium"}
                    sx={{ minHeight: { xs: 44, sm: 'auto' }, flex: isMobile ? '1 1 100%' : '0 1 auto' }}
                  >
                    {syncingOzon ? 'Синхронизация...' : 'Синхронизировать'}
                  </Button>
                </Box>

                {syncingOzon && syncProgress && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Синхронизация товаров: {syncProgress.current} / {syncProgress.total > 0 ? syncProgress.total : '...'}
                    </Typography>
                    {syncProgress.total > 0 && (
                      <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CircularProgress
                          variant="determinate"
                          value={(syncProgress.current / syncProgress.total) * 100}
                          size={24}
                        />
                        <Typography variant="caption" color="text.secondary">
                          {Math.round((syncProgress.current / syncProgress.total) * 100)}%
                        </Typography>
                      </Box>
                    )}
                  </Box>
                )}

                <Alert severity="info" sx={{ mt: 2 }}>
                  Автоматическая синхронизация товаров выполняется каждый час.
                </Alert>
              </>
            )}
          </Paper>
        </Grid>

        {/* Настройки Sidebar */}
        <Grid item xs={12}>
          <Paper
            sx={{
              p: 3,
              background: mode === 'dark'
                ? 'rgba(30, 30, 30, 0.9)'
                : 'rgba(255, 255, 255, 0.9)',
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              border: mode === 'dark'
                ? '1px solid rgba(255, 255, 255, 0.1)'
                : '1px solid rgba(0, 0, 0, 0.1)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <MenuIcon />
              <Typography variant="h6">
                Боковое меню (Sidebar)
              </Typography>
            </Box>

            <FormControlLabel
              control={
                <Switch
                  checked={settings.sidebarEnabled}
                  onChange={(e) => setSettings({ ...settings, sidebarEnabled: e.target.checked })}
                />
              }
              label="Включить боковое меню"
            />

            <Alert severity="info" sx={{ mt: 2 }}>
              При отключении боковое меню будет скрыто на всех устройствах. Навигация будет доступна только через верхнюю панель и мобильное нижнее меню.
            </Alert>
          </Paper>
        </Grid>

        {/* Управление видимостью страниц */}
        <Grid item xs={12}>
          <Paper
            sx={{
              p: 3,
              background: mode === 'dark'
                ? 'rgba(30, 30, 30, 0.9)'
                : 'rgba(255, 255, 255, 0.9)',
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              border: mode === 'dark'
                ? '1px solid rgba(255, 255, 255, 0.1)'
                : '1px solid rgba(0, 0, 0, 0.1)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <MenuIcon />
              <Typography variant="h6">
                Управление видимостью страниц
              </Typography>
            </Box>

            <Alert severity="info" sx={{ mb: 3 }}>
              Выберите страницы, которые нужно скрыть от всех пользователей. Скрытые страницы не будут отображаться в меню и будут недоступны для перехода.
            </Alert>

            <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
              Скрыть страницы:
            </Typography>
            <FormGroup>
              {ALL_PAGES.map((page) => (
                <FormControlLabel
                  key={page.path}
                  control={
                    <Checkbox
                      checked={settings.hiddenPages?.includes(page.path) || false}
                      onChange={(e) => {
                        const currentHidden = settings.hiddenPages || [];
                        if (e.target.checked) {
                          if (!currentHidden.includes(page.path)) {
                            setSettings({
                              ...settings,
                              hiddenPages: [...currentHidden, page.path],
                            });
                          }
                        } else {
                          setSettings({
                            ...settings,
                            hiddenPages: currentHidden.filter((p) => p !== page.path),
                          });
                        }
                      }}
                    />
                  }
                  label={page.label}
                />
              ))}
            </FormGroup>

            <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button
                size="small"
                variant="outlined"
                onClick={() => {
                  setSettings({
                    ...settings,
                    hiddenPages: ALL_PAGES.map((p) => p.path),
                  });
                }}
              >
                Скрыть все
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={() => {
                  setSettings({
                    ...settings,
                    hiddenPages: [],
                  });
                }}
              >
                Показать все
              </Button>
            </Box>
          </Paper>
        </Grid>

        {/* Настройки прав ролей */}
        <Grid item xs={12}>
          <Paper
            sx={{
              p: 3,
              background: mode === 'dark'
                ? 'rgba(30, 30, 30, 0.9)'
                : 'rgba(255, 255, 255, 0.9)',
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              border: mode === 'dark'
                ? '1px solid rgba(255, 255, 255, 0.1)'
                : '1px solid rgba(0, 0, 0, 0.1)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <SecurityIcon />
              <Typography variant="h6">
                Права доступа ролей
              </Typography>
            </Box>

            <Alert severity="info" sx={{ mb: 3 }}>
              Настройте видимость страниц и доступ к маршрутам для каждой роли. 
              <strong>Видимые страницы</strong> - страницы, которые отображаются в меню. 
              <strong>Доступные маршруты</strong> - маршруты, к которым пользователь может получить доступ напрямую.
            </Alert>

            {ALL_ROLES.map((role) => {
              const rolePerms = settings.rolePermissions?.[role] || {
                visiblePages: [],
                accessibleRoutes: [],
              };

              return (
                <Accordion key={role} sx={{ mb: 2 }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="h6" sx={{ textTransform: 'capitalize' }}>
                      {role === 'director' ? 'Директор' : 'Сборщик'}
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box sx={{ mb: 3 }}>
                      <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                        Видимые страницы в меню:
                      </Typography>
                      <FormGroup>
                        {ALL_PAGES.map((page) => (
                          <FormControlLabel
                            key={page.path}
                            control={
                              <Checkbox
                                checked={rolePerms.visiblePages.includes(page.path)}
                                onChange={(e) => {
                                  const newPerms = { ...rolePerms };
                                  if (e.target.checked) {
                                    if (!newPerms.visiblePages.includes(page.path)) {
                                      newPerms.visiblePages.push(page.path);
                                    }
                                  } else {
                                    newPerms.visiblePages = newPerms.visiblePages.filter(
                                      (p) => p !== page.path
                                    );
                                  }
                                  setSettings({
                                    ...settings,
                                    rolePermissions: {
                                      ...settings.rolePermissions,
                                      [role]: newPerms,
                                    },
                                  });
                                }}
                              />
                            }
                            label={page.label}
                          />
                        ))}
                      </FormGroup>
                    </Box>

                    <Divider sx={{ my: 2 }} />

                    <Box>
                      <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                        Доступные маршруты:
                      </Typography>
                      <FormGroup>
                        {ALL_PAGES.map((page) => (
                          <FormControlLabel
                            key={page.path}
                            control={
                              <Checkbox
                                checked={rolePerms.accessibleRoutes.includes(page.path)}
                                onChange={(e) => {
                                  const newPerms = { ...rolePerms };
                                  if (e.target.checked) {
                                    if (!newPerms.accessibleRoutes.includes(page.path)) {
                                      newPerms.accessibleRoutes.push(page.path);
                                    }
                                  } else {
                                    newPerms.accessibleRoutes = newPerms.accessibleRoutes.filter(
                                      (p) => p !== page.path
                                    );
                                  }
                                  setSettings({
                                    ...settings,
                                    rolePermissions: {
                                      ...settings.rolePermissions,
                                      [role]: newPerms,
                                    },
                                  });
                                }}
                              />
                            }
                            label={page.label}
                          />
                        ))}
                      </FormGroup>
                    </Box>

                    <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => {
                          setSettings({
                            ...settings,
                            rolePermissions: {
                              ...settings.rolePermissions,
                              [role]: {
                                visiblePages: ALL_PAGES.map((p) => p.path),
                                accessibleRoutes: ALL_PAGES.map((p) => p.path),
                              },
                            },
                          });
                        }}
                      >
                        Выбрать все
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => {
                          setSettings({
                            ...settings,
                            rolePermissions: {
                              ...settings.rolePermissions,
                              [role]: {
                                visiblePages: [],
                                accessibleRoutes: [],
                              },
                            },
                          });
                        }}
                      >
                        Снять все
                      </Button>
                    </Box>
                  </AccordionDetails>
                </Accordion>
              );
            })}
          </Paper>
        </Grid>

        {/* Настройки Yandex Market API */}
        <Grid item xs={12}>
          <Paper
            sx={{
              p: 3,
              background: mode === 'dark'
                ? 'rgba(30, 30, 30, 0.9)'
                : 'rgba(255, 255, 255, 0.9)',
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              border: mode === 'dark'
                ? '1px solid rgba(255, 255, 255, 0.1)'
                : '1px solid rgba(0, 0, 0, 0.1)',
            }}
          >
            <Typography variant="h6" sx={{ mb: 2 }}>
              Yandex Market API
            </Typography>

            <Alert severity="info" sx={{ mb: 2 }}>
              Управление аккаунтами Yandex Market доступно на странице "Yandex Market". 
              Здесь вы можете просматривать и управлять всеми подключенными аккаунтами.
            </Alert>

            <Button
              variant="outlined"
              onClick={() => window.location.href = '/yandex'}
              size={isMobile ? "large" : "medium"}
              fullWidth={isMobile}
            >
              Перейти к управлению аккаунтами
            </Button>
          </Paper>
        </Grid>
      </Grid>

      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
        <Button
          variant="outlined"
          onClick={fetchSettings}
          size={isMobile ? "large" : "medium"}
          fullWidth={isMobile}
        >
          Отмена
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving}
          startIcon={saving ? <CircularProgress size={20} /> : <SettingsIcon />}
          size={isMobile ? "large" : "medium"}
          fullWidth={isMobile}
        >
          {saving ? 'Сохранение...' : 'Сохранить настройки'}
        </Button>
      </Box>
    </Box>
  );
};

export default Settings;

