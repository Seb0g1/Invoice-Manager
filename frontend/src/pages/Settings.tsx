import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Paper, Typography, Button, TextField, Switch, FormControlLabel,
  CircularProgress, LinearProgress,
  Alert, Grid, useMediaQuery, ToggleButton, ToggleButtonGroup,
  InputAdornment, IconButton
} from '@mui/material';
import {
  Settings as SettingsIcon, Send as SendIcon, Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon, DarkMode as DarkModeIcon,
  LightMode as LightModeIcon, AutoMode as AutoModeIcon,
  Sync as SyncIcon, People as PeopleIcon
} from '@mui/icons-material';
import api from '../services/api';
import { useThemeContext } from '../contexts/ThemeContext';
import { useAuthStore } from '../store/authStore';
import { useNavigate, useLocation } from 'react-router-dom';
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
  ozonClientId: string;
  ozonApiKey: string;
  ozonEnabled: boolean;
}


const Settings: React.FC = () => {
  const { theme, mode, setTheme } = useThemeContext();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  // Проверяем, что сборщик на странице профиля
  const isProfilePage = location.pathname === '/settings/profile';
  
  // Если сборщик пытается зайти в обычные настройки, перенаправляем
  useEffect(() => {
    if (user?.role === 'collector' && !isProfilePage) {
      navigate('/settings/profile', { replace: true });
    } else if (user?.role === 'director' && isProfilePage) {
      navigate('/settings', { replace: true });
    }
  }, [user, isProfilePage, navigate]);

  // Проверяем статус синхронизации при загрузке страницы
  useEffect(() => {
    const checkSyncStatus = async () => {
      try {
        const progressResponse = await api.get('/ozon/sync/progress');
        
        if (progressResponse.data.status === 'processing') {
          // Восстанавливаем состояние синхронизации
          setSyncingOzon(true);
          if (progressResponse.data.progress) {
            setSyncProgress({
              current: progressResponse.data.progress.current || 0,
              total: progressResponse.data.progress.total || 0,
              stage: progressResponse.data.progress.stage || 'Синхронизация...',
            });
          }
          
          // Запускаем опрос прогресса
          if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
          }
          progressIntervalRef.current = setInterval(async () => {
            try {
              const currentProgressResponse = await api.get('/ozon/sync/progress');
              
              if (currentProgressResponse.data.status === 'completed') {
                if (progressIntervalRef.current) {
                  clearInterval(progressIntervalRef.current);
                  progressIntervalRef.current = null;
                }
                const result = currentProgressResponse.data.result;
                toast.success(`Синхронизация завершена! Синхронизировано товаров: ${result?.synced || 0} из ${result?.total || 0} за ${result?.duration || 0}с`);
                
                // Обновляем прогресс для этапа обновления данных
                setSyncProgress({
                  current: 0,
                  total: 0,
                  stage: 'Обновление списка товаров...',
                });
                
                // Запускаем обновление данных через API
                try {
                  let allProductsData: any[] = [];
                  let currentLastId: string | undefined = undefined;
                  let hasMoreData = true;
                  let iterationCount = 0;
                  const maxIterations = 200;
                  
                  while (hasMoreData && iterationCount < maxIterations) {
                    const params: any = { limit: 100, forceRefresh: 'true' };
                    if (currentLastId) {
                      params.lastId = currentLastId;
                    }
                    
                    setSyncProgress({
                      current: allProductsData.length,
                      total: result?.total || 0,
                      stage: `Обновление списка товаров: ${allProductsData.length}...`,
                    });
                    
                    const response = await api.get('/ozon/products', { params });
                    
                    if (response.data.products && response.data.products.length > 0) {
                      allProductsData = [...allProductsData, ...response.data.products];
                      currentLastId = response.data.lastId;
                      hasMoreData = !!currentLastId && response.data.products.length >= 100;
                      iterationCount++;
                      
                      setSyncProgress({
                        current: allProductsData.length,
                        total: result?.total || allProductsData.length,
                        stage: `Обновление списка товаров: ${allProductsData.length}...`,
                      });
                      
                      if (hasMoreData) {
                        await new Promise(resolve => setTimeout(resolve, 300));
                      }
                    } else {
                      hasMoreData = false;
                    }
                  }
                  
                  toast.success(`Обновлено товаров: ${allProductsData.length}`);
                } catch (error: any) {
                  console.error('Ошибка при обновлении списка товаров:', error);
                  toast.error('Ошибка при обновлении списка товаров');
                }
                
                setSyncingOzon(false);
                setSyncProgress(null);
                
                // Перекидываем на страницу товаров OZON
                setTimeout(() => {
                  navigate('/ozon');
                }, 1000);
              } else if (currentProgressResponse.data.status === 'error') {
                if (progressIntervalRef.current) {
                  clearInterval(progressIntervalRef.current);
                  progressIntervalRef.current = null;
                }
                setSyncingOzon(false);
                setSyncProgress(null);
                toast.error(currentProgressResponse.data.error || 'Ошибка при синхронизации');
              } else if (currentProgressResponse.data.progress) {
                setSyncProgress({
                  current: currentProgressResponse.data.progress.current || 0,
                  total: currentProgressResponse.data.progress.total || 0,
                  stage: currentProgressResponse.data.progress.stage || 'Синхронизация...',
                });
              }
            } catch (error: any) {
              console.error('Ошибка при получении прогресса:', error);
            }
          }, 2000);
        }
      } catch (error: any) {
        // Игнорируем ошибки при проверке статуса
        console.log('Синхронизация не запущена или ошибка проверки:', error.message);
      }
    };
    
    // Проверяем только если пользователь директор и на странице настроек
    if (user?.role === 'director' && !isProfilePage) {
      checkSyncStatus();
    }
    
    // Очищаем интервал при размонтировании компонента
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
  }, [user, isProfilePage, navigate]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [testingOzon, setTestingOzon] = useState(false);
  const [syncingOzon, setSyncingOzon] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number; stage?: string } | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
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

      // Запускаем синхронизацию
      await api.get('/ozon/sync');

      // Опрашиваем прогресс каждые 2 секунды
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      progressIntervalRef.current = setInterval(async () => {
        try {
          const progressResponse = await api.get('/ozon/sync/progress');
          
          if (progressResponse.data.status === 'completed') {
            if (progressIntervalRef.current) {
              clearInterval(progressIntervalRef.current);
              progressIntervalRef.current = null;
            }
            const result = progressResponse.data.result;
            toast.success(`Синхронизация завершена! Синхронизировано товаров: ${result?.synced || 0} из ${result?.total || 0} за ${result?.duration || 0}с`);
            
            // Обновляем прогресс для этапа обновления данных
            setSyncProgress({
              current: 0,
              total: 0,
              stage: 'Обновление списка товаров...',
            });
            
            // Запускаем обновление данных через API
            try {
              let allProductsData: any[] = [];
              let currentLastId: string | undefined = undefined;
              let hasMoreData = true;
              let iterationCount = 0;
              const maxIterations = 200;
              
              while (hasMoreData && iterationCount < maxIterations) {
                const params: any = { limit: 100, forceRefresh: 'true' };
                if (currentLastId) {
                  params.lastId = currentLastId;
                }
                
                setSyncProgress({
                  current: allProductsData.length,
                  total: result?.total || 0,
                  stage: `Обновление списка товаров: ${allProductsData.length}...`,
                });
                
                const response = await api.get('/ozon/products', { params });
                
                if (response.data.products && response.data.products.length > 0) {
                  allProductsData = [...allProductsData, ...response.data.products];
                  currentLastId = response.data.lastId;
                  hasMoreData = !!currentLastId && response.data.products.length >= 100;
                  iterationCount++;
                  
                  setSyncProgress({
                    current: allProductsData.length,
                    total: result?.total || allProductsData.length,
                    stage: `Обновление списка товаров: ${allProductsData.length}...`,
                  });
                  
                  if (hasMoreData) {
                    await new Promise(resolve => setTimeout(resolve, 300));
                  }
                } else {
                  hasMoreData = false;
                }
              }
              
              toast.success(`Обновлено товаров: ${allProductsData.length}`);
            } catch (error: any) {
              console.error('Ошибка при обновлении списка товаров:', error);
              toast.error('Ошибка при обновлении списка товаров');
            }
            
            // Завершаем синхронизацию
            setSyncingOzon(false);
            setSyncProgress(null);
            
            // Перекидываем на страницу товаров OZON
            setTimeout(() => {
              navigate('/ozon');
            }, 1000);
          } else if (progressResponse.data.status === 'error') {
            if (progressIntervalRef.current) {
              clearInterval(progressIntervalRef.current);
              progressIntervalRef.current = null;
            }
            setSyncingOzon(false);
            setSyncProgress(null);
            toast.error(progressResponse.data.error || 'Ошибка при синхронизации');
          } else if (progressResponse.data.progress) {
            setSyncProgress({
              current: progressResponse.data.progress.current || 0,
              total: progressResponse.data.progress.total || 0,
              stage: progressResponse.data.progress.stage || 'Синхронизация...',
            });
          }
        } catch (error: any) {
          console.error('Ошибка при получении прогресса:', error);
        }
      }, 2000);

      // Останавливаем опрос через 30 минут (на случай зависания)
      setTimeout(() => {
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
        if (syncingOzon) {
          setSyncingOzon(false);
          toast.error('Синхронизация заняла слишком много времени');
        }
      }, 30 * 60 * 1000);
      
      // Очищаем интервал при размонтировании компонента
      return () => {
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
        }
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

  // Если это страница профиля для сборщика, показываем только тему
  if (isProfilePage && user?.role === 'collector') {
    return (
      <Box sx={{ p: { xs: 1.5, sm: 2, md: 3 } }}>
        <Typography variant="h4" sx={{ mb: 3, fontSize: { xs: '1.5rem', sm: '2rem' } }}>
          Настройки профиля
        </Typography>
        
        <Grid container spacing={3}>
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
            {saving ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </Box>
      </Box>
    );
  }

  // Настройки для директора
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
                      {syncProgress.stage || 'Синхронизация...'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {syncProgress.total > 0 
                        ? `Товаров: ${syncProgress.current} / ${syncProgress.total}`
                        : 'Запуск синхронизации...'}
                    </Typography>
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
                    {syncProgress.total === 0 && (
                      <Box sx={{ width: '100%', mt: 1 }}>
                        <LinearProgress sx={{ height: 8, borderRadius: 4 }} />
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

        {/* Настройки пользователей */}
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
              <PeopleIcon />
              <Typography variant="h6">
                Настройки пользователей
              </Typography>
            </Box>

            <Alert severity="info" sx={{ mb: 2 }}>
              Управление пользователями доступно на странице "Пользователи". 
              Здесь вы можете создавать, редактировать и удалять пользователей системы.
            </Alert>

            <Button
              variant="outlined"
              onClick={() => navigate('/users')}
              size={isMobile ? "large" : "medium"}
              fullWidth={isMobile}
            >
              Перейти к управлению пользователями
            </Button>
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

