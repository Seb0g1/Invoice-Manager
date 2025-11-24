import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ThemeProvider as MUIThemeProvider, createTheme, CssBaseline, Theme } from '@mui/material';

type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  mode: ThemeMode;
  toggleTheme: () => void;
  theme: Theme;
  setTheme: (theme: 'light' | 'dark' | 'auto') => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useThemeContext = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeContext must be used within ThemeContextProvider');
  }
  return context;
};

interface ThemeContextProviderProps {
  children: ReactNode;
}

// Glassmorphism стили для iOS
const glassStyle = (mode: ThemeMode) => ({
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
});

export const ThemeContextProvider: React.FC<ThemeContextProviderProps> = ({ children }) => {
  const [themePreference, setThemePreference] = useState<'light' | 'dark' | 'auto'>(() => {
    const saved = localStorage.getItem('themePreference');
    return (saved as 'light' | 'dark' | 'auto') || 'auto';
  });

  const [mode, setMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('themeMode');
    return (saved as ThemeMode) || 'light';
  });

  // Функция для определения текущего времени в МСК
  const getMoscowTime = () => {
    const now = new Date();
    const moscowTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
    return moscowTime;
  };

  // Функция для проверки, нужно ли включить ночной режим
  const shouldUseDarkMode = (startTime: string, endTime: string): boolean => {
    const now = getMoscowTime();
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    
    const start = new Date(now);
    start.setHours(startHour, startMin, 0, 0);
    
    const end = new Date(now);
    end.setHours(endHour, endMin, 0, 0);
    
    // Если время окончания меньше времени начала, значит это переход через полночь
    if (end < start) {
      return now >= start || now < end;
    } else {
      return now >= start && now < end;
    }
  };

  // Проверка автоматического ночного режима (только для директоров, но проверяем для всех)
  useEffect(() => {
    const checkAutoNightMode = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return; // Если пользователь не авторизован, пропускаем
        
        const response = await fetch('/api/settings', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (response.ok) {
          const settings = await response.json();
          setThemePreference(settings.theme || 'auto');
          
          if (settings.autoNightModeEnabled && settings.theme === 'auto') {
            const shouldDark = shouldUseDarkMode(
              settings.nightModeStartTime || '22:00',
              settings.nightModeEndTime || '07:00'
            );
            setMode(shouldDark ? 'dark' : 'light');
          } else if (settings.theme === 'auto') {
            // Если авто-режим включен, но автоматический ночной режим выключен,
            // используем системные настройки
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            setMode(prefersDark ? 'dark' : 'light');
          } else if (settings.theme === 'light' || settings.theme === 'dark') {
            setMode(settings.theme);
          }
        }
      } catch (error) {
        // Если не удалось загрузить настройки, используем сохраненное значение
        // Это нормально для неавторизованных пользователей или если настройки еще не созданы
      }
    };

    checkAutoNightMode();
    // Проверяем каждую минуту
    const interval = setInterval(checkAutoNightMode, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    localStorage.setItem('themeMode', mode);
    localStorage.setItem('themePreference', themePreference);
  }, [mode, themePreference]);

  const toggleTheme = () => {
    setMode((prev) => (prev === 'light' ? 'dark' : 'light'));
    setThemePreference((prev) => {
      if (prev === 'auto') return 'light';
      return prev === 'light' ? 'dark' : 'light';
    });
  };

  const setTheme = (theme: 'light' | 'dark' | 'auto') => {
    setThemePreference(theme);
    if (theme === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setMode(prefersDark ? 'dark' : 'light');
    } else {
      setMode(theme);
    }
  };

  const theme = createTheme({
    palette: {
      mode,
      primary: {
        main: mode === 'dark' ? '#0A84FF' : '#007AFF',
        light: mode === 'dark' ? '#40A6FF' : '#5AC8FA',
        dark: mode === 'dark' ? '#0051D5' : '#0051D5',
      },
      secondary: {
        main: mode === 'dark' ? '#FF375F' : '#FF3B30',
      },
      background: {
        default: mode === 'dark' 
          ? 'linear-gradient(135deg, #000000 0%, #1C1C1E 50%, #000000 100%)'
          : 'linear-gradient(135deg, #F2F2F7 0%, #FFFFFF 50%, #F2F2F7 100%)',
        paper: mode === 'dark' ? 'rgba(28, 28, 30, 0.8)' : 'rgba(255, 255, 255, 0.8)',
      },
      text: {
        primary: mode === 'dark' ? '#FFFFFF' : '#000000',
        secondary: mode === 'dark' ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)',
      },
    },
    typography: {
      fontFamily: '"SF Pro Display", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", sans-serif',
      h1: {
        fontWeight: 700,
        fontSize: '2.5rem',
        letterSpacing: '-0.02em',
      },
      h2: {
        fontWeight: 700,
        fontSize: '2rem',
        letterSpacing: '-0.01em',
      },
      h3: {
        fontWeight: 600,
        fontSize: '1.75rem',
        letterSpacing: '-0.01em',
      },
      h4: {
        fontWeight: 600,
        fontSize: '1.5rem',
        letterSpacing: '-0.01em',
      },
      h5: {
        fontWeight: 600,
        fontSize: '1.25rem',
      },
      h6: {
        fontWeight: 600,
        fontSize: '1rem',
      },
      body1: {
        fontSize: '1rem',
        lineHeight: 1.5,
      },
      body2: {
        fontSize: '0.875rem',
        lineHeight: 1.43,
      },
    },
    shape: {
      borderRadius: 16,
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            background: mode === 'dark'
              ? 'linear-gradient(135deg, #000000 0%, #1C1C1E 50%, #000000 100%)'
              : 'linear-gradient(135deg, #F2F2F7 0%, #FFFFFF 50%, #F2F2F7 100%)',
            backgroundAttachment: 'fixed',
            minHeight: '100vh',
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            ...glassStyle(mode),
            borderRadius: 20,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              transform: 'translateY(-4px) scale(1.01)',
              boxShadow: mode === 'dark'
                ? '0 12px 48px 0 rgba(0, 0, 0, 0.5)'
                : '0 12px 48px 0 rgba(31, 38, 135, 0.25)',
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            ...glassStyle(mode),
            borderRadius: 20,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          },
          elevation1: {
            boxShadow: mode === 'dark'
              ? '0 2px 8px 0 rgba(0, 0, 0, 0.3)'
              : '0 2px 8px 0 rgba(31, 38, 135, 0.1)',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            borderRadius: 12,
            fontWeight: 600,
            padding: '12px 24px',
            fontSize: '1rem',
            minHeight: 40,
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:active': {
              transform: 'scale(0.98)',
            },
            '@media (max-width: 600px)': {
              padding: '14px 24px',
              fontSize: '0.9375rem',
              minHeight: 48,
            },
          } as any,
          contained: {
            background: mode === 'dark'
              ? 'linear-gradient(135deg, #0A84FF 0%, #5AC8FA 100%)'
              : 'linear-gradient(135deg, #007AFF 0%, #5AC8FA 100%)',
            color: '#FFFFFF',
            boxShadow: mode === 'dark'
              ? '0 4px 16px rgba(10, 132, 255, 0.4)'
              : '0 4px 16px rgba(0, 122, 255, 0.3)',
            '&:hover': {
              background: mode === 'dark'
                ? 'linear-gradient(135deg, #5AC8FA 0%, #0A84FF 100%)'
                : 'linear-gradient(135deg, #5AC8FA 0%, #007AFF 100%)',
              boxShadow: mode === 'dark'
                ? '0 6px 20px rgba(10, 132, 255, 0.5)'
                : '0 6px 20px rgba(0, 122, 255, 0.4)',
              transform: 'translateY(-2px)',
            },
          },
          outlined: {
            borderWidth: 1.5,
            borderColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
            '&:hover': {
              borderWidth: 1.5,
              borderColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)',
              background: mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
            },
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 12,
              ...glassStyle(mode),
              '& fieldset': {
                borderColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              },
              '&:hover fieldset': {
                borderColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
              },
              '&.Mui-focused fieldset': {
                borderColor: mode === 'dark' ? '#0A84FF' : '#007AFF',
                borderWidth: 2,
              },
              '& input': {
                textTransform: 'none',
              },
            },
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            ...glassStyle(mode),
            borderRadius: 0,
            boxShadow: 'none',
            borderBottom: mode === 'dark'
              ? '1px solid rgba(255, 255, 255, 0.1)'
              : '1px solid rgba(0, 0, 0, 0.1)',
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            ...glassStyle(mode),
            borderRight: mode === 'dark'
              ? '1px solid rgba(255, 255, 255, 0.1)'
              : '1px solid rgba(0, 0, 0, 0.1)',
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            fontWeight: 500,
            ...glassStyle(mode),
          },
        },
      },
      MuiTableContainer: {
        styleOverrides: {
          root: {
            ...glassStyle(mode),
            borderRadius: 20,
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            ...glassStyle(mode),
            borderRadius: 24,
            padding: '8px',
          },
        },
      },
    },
  });

  return (
    <ThemeContext.Provider value={{ mode, toggleTheme, theme, setTheme }}>
      <MUIThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MUIThemeProvider>
    </ThemeContext.Provider>
  );
};
