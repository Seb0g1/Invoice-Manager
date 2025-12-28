import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Sidebar from './components/Sidebar';
import MobileBottomNav from './components/MobileBottomNav';
import Footer from './components/Footer';
import PageLoader from './components/PageLoader';
import AppRoutes from './components/AppRoutes';
import Login from './pages/Login';
import ErrorBoundary from './components/ErrorBoundary';
import { useAuthStore } from './store/authStore';
import { useCurrencyStore } from './store/currencyStore';
import { ThemeContextProvider, useThemeContext } from './contexts/ThemeContext';
import { Box, AppBar, Toolbar, Typography, Button, IconButton, Tooltip, ToggleButton, ToggleButtonGroup, useMediaQuery } from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import CurrencyRubleIcon from '@mui/icons-material/CurrencyRuble';
import api from './services/api';

const AppContent: React.FC = () => {
  const { user, loading, checkAuth, logout } = useAuthStore();
  const { mode, toggleTheme, theme } = useThemeContext();
  const { currency, setCurrency, fetchRate } = useCurrencyStore();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [sidebarEnabled, setSidebarEnabled] = useState(true);

  useEffect(() => {
    checkAuth();
    // Загружаем курс валют (публичный endpoint, не требует авторизации)
    fetchRate();
    // Обновляем курс каждые 5 минут
    const interval = setInterval(fetchRate, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [checkAuth, fetchRate]);

  // Загружаем настройки sidebar
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await api.get('/settings');
        setSidebarEnabled(response.data.sidebarEnabled !== undefined ? response.data.sidebarEnabled : true);
      } catch (error) {
        console.error('Error fetching settings:', error);
      }
    };
    if (user) {
      fetchSettings();
    }
  }, [user]);

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  const handleCurrencyChange = (_: React.MouseEvent<HTMLElement>, newCurrency: 'RUB' | 'USD' | null) => {
    if (newCurrency !== null) {
      setCurrency(newCurrency);
    }
  };

  if (loading) {
    return <PageLoader />;
  }

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/*"
            element={
              user ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
                <Box sx={{ display: 'flex', flexGrow: 1 }}>
                  <Sidebar />
                  <Box component="main" sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                    <AppBar 
                      position="fixed" 
                      sx={{ 
                        zIndex: (theme) => theme.zIndex.drawer + 1,
                        ml: { md: sidebarEnabled ? '240px' : 0 },
                        width: { md: sidebarEnabled ? 'calc(100% - 240px)' : '100%' },
                        backgroundColor: mode === 'dark' 
                          ? 'rgba(30, 30, 30, 0.9)' 
                          : 'rgba(255, 255, 255, 0.9)',
                        color: mode === 'dark' ? '#FFFFFF' : '#000000',
                        backdropFilter: 'blur(20px) saturate(180%)',
                        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                        borderBottom: mode === 'dark'
                          ? '1px solid rgba(255, 255, 255, 0.1)'
                          : '1px solid rgba(0, 0, 0, 0.1)',
                        transition: 'margin-left 0.3s, width 0.3s',
                      }}
                    >
                      <Toolbar sx={{ minHeight: { xs: 56, sm: 64 } }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexGrow: 1 }}>
                          <img 
                            src="/Logo.svg" 
                            alt="David Manager Logo" 
                            style={{ 
                              height: isMobile ? '32px' : '40px',
                              width: 'auto',
                            }}
                          />
                          <Typography 
                            variant={isMobile ? "subtitle1" : "h6"}
                            component="div" 
                            sx={{ 
                              fontWeight: 700,
                              fontSize: { xs: '0.875rem', sm: '1.25rem' },
                              color: 'inherit',
                            }}
                          >
                            {isMobile ? 'David' : 'David Manager'}
                          </Typography>
                        </Box>
                      
                      {user.role === 'director' && !isMobile && (
                        <ToggleButtonGroup
                          value={currency}
                          exclusive
                          onChange={handleCurrencyChange}
                          size="small"
                          sx={{ 
                            mr: 2,
                            '& .MuiToggleButton-root': {
                              color: mode === 'dark' ? '#FFFFFF' : '#000000',
                              borderColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)',
                              '&.Mui-selected': {
                                backgroundColor: mode === 'dark' 
                                  ? 'rgba(255, 255, 255, 0.15)' 
                                  : 'rgba(0, 0, 0, 0.08)',
                                color: mode === 'dark' ? '#FFFFFF' : '#000000',
                                '&:hover': {
                                  backgroundColor: mode === 'dark' 
                                    ? 'rgba(255, 255, 255, 0.2)' 
                                    : 'rgba(0, 0, 0, 0.12)',
                                },
                              },
                              '&:hover': {
                                backgroundColor: mode === 'dark' 
                                  ? 'rgba(255, 255, 255, 0.1)' 
                                  : 'rgba(0, 0, 0, 0.05)',
                              },
                            },
                          }}
                        >
                          <ToggleButton value="RUB">
                            <CurrencyRubleIcon sx={{ mr: 0.5 }} />
                            RUB
                          </ToggleButton>
                          <ToggleButton value="USD">
                            <AttachMoneyIcon sx={{ mr: 0.5 }} />
                            USD
                          </ToggleButton>
                        </ToggleButtonGroup>
                      )}
                      
                      <Tooltip title={mode === 'dark' ? 'Светлая тема' : 'Тёмная тема'}>
                        <IconButton 
                          onClick={toggleTheme} 
                          color="inherit" 
                          sx={{ mr: { xs: 0.5, sm: 1 } }}
                          size={isMobile ? "small" : "medium"}
                        >
                          {mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
                        </IconButton>
                      </Tooltip>
                      
                      {isMobile ? (
                        <IconButton
                          color="inherit"
                          onClick={handleLogout}
                          size="medium"
                          sx={{
                            color: 'inherit',
                            '&:hover': {
                              background: mode === 'dark' 
                                ? 'rgba(255, 255, 255, 0.1)' 
                                : 'rgba(0, 0, 0, 0.08)',
                            },
                          }}
                          title="Выход"
                        >
                          <LogoutIcon />
                        </IconButton>
                      ) : (
                        <>
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              mr: 2, 
                              display: { xs: 'none', sm: 'block' },
                              color: 'inherit',
                            }}
                          >
                            {user.login} ({user.role === 'director' ? 'Директор' : 'Сборщик'})
                          </Typography>
                          <Button
                            color="inherit"
                            startIcon={<LogoutIcon />}
                            onClick={handleLogout}
                            size="medium"
                            sx={{
                              color: 'inherit',
                              '&:hover': {
                                background: mode === 'dark' 
                                  ? 'rgba(255, 255, 255, 0.1)' 
                                  : 'rgba(0, 0, 0, 0.08)',
                              },
                            }}
                          >
                            Выход
                          </Button>
                        </>
                      )}
                    </Toolbar>
                  </AppBar>
                    <Toolbar />
                    <Box sx={{ 
                      p: { xs: 1, sm: 2, md: 3 },
                      pb: { xs: 10, md: 3 }, // Отступ снизу для bottom nav на мобильных
                      flexGrow: 1,
                      width: '100%',
                      maxWidth: '100%',
                      overflowX: 'hidden'
                    }}>
                      <AppRoutes />
                    </Box>
                    <Footer />
                    <MobileBottomNav />
                  </Box>
                </Box>
              </Box>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </BrowserRouter>
    </ErrorBoundary>
  );
};

const App: React.FC = () => {
  return (
    <ThemeContextProvider>
      <AppContent />
      <Toaster 
        position="top-right"
        toastOptions={{
          style: {
            borderRadius: '12px',
            padding: '16px',
          },
        }}
      />
    </ThemeContextProvider>
  );
};

export default App;

