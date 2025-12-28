import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  CircularProgress
} from '@mui/material';
import { useAuthStore } from '../store/authStore';
import { useThemeContext } from '../contexts/ThemeContext';
import toast from 'react-hot-toast';

const Login: React.FC = () => {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, login: loginUser, checkAuth } = useAuthStore();
  const { mode } = useThemeContext();
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth().then(() => {
      if (user) {
        navigate(user.role === 'director' ? '/suppliers' : '/invoices');
      }
    });
  }, []);

  useEffect(() => {
    if (user) {
      navigate(user.role === 'director' ? '/suppliers' : '/invoices');
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await loginUser(login, password);
      
      // Небольшая задержка для установки cookies
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Проверяем авторизацию после входа
      await checkAuth();
      
      const currentUser = useAuthStore.getState().user;
      if (currentUser) {
        toast.success('Успешный вход!');
        navigate(currentUser.role === 'director' ? '/suppliers' : '/invoices');
      } else {
        // Проверяем cookies вручную
        const cookies = document.cookie;
        if (!cookies.includes('token')) {
          toast.error('Cookie не установлена. Проверьте настройки браузера и Nginx.');
          console.error('Cookies после входа:', cookies || 'нет cookies');
        } else {
          toast.error('Ошибка авторизации. Попробуйте обновить страницу.');
        }
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Ошибка входа';
      toast.error(errorMessage);
      
      // Дополнительная диагностика
      if (error.response?.status === 401) {
        console.error('Ошибка входа: неверный логин или пароль');
        console.error('Используйте: director / CGJ-Ge-90');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Paper 
          sx={{ 
            p: { xs: 3, sm: 4 }, 
            width: '100%',
            maxWidth: 450,
            mx: { xs: 2, sm: 0 },
            background: mode === 'dark'
              ? 'rgba(30, 30, 30, 0.7)'
              : 'rgba(255, 255, 255, 0.7)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            border: mode === 'dark'
              ? '1px solid rgba(255, 255, 255, 0.1)'
              : '1px solid rgba(255, 255, 255, 0.8)',
            boxShadow: mode === 'dark'
              ? '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
              : '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
          }}
        >
          <Typography 
            variant="h4" 
            component="h1" 
            gutterBottom 
            align="center"
            sx={{
              fontWeight: 700,
              background: mode === 'dark'
                ? 'linear-gradient(45deg, #90caf9, #f48fb1)'
                : 'linear-gradient(45deg, #667eea, #764ba2)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Вход в систему
          </Typography>
          <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
            Учёт накладных от поставщиков
          </Typography>
          
          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Логин"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              margin="normal"
              required
              autoFocus
              autoComplete="username"
              InputProps={{
                style: { textTransform: 'none' }
              }}
              inputProps={{
                style: { textTransform: 'none' }
              }}
            />
            <TextField
              fullWidth
              label="Пароль"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              margin="normal"
              required
              autoComplete="current-password"
              InputProps={{
                style: { textTransform: 'none' }
              }}
              inputProps={{
                style: { textTransform: 'none' }
              }}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ 
                mt: 3,
              }}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : 'Войти'}
            </Button>
          </form>
        </Paper>
      </Box>
    </Container>
  );
};

export default Login;

