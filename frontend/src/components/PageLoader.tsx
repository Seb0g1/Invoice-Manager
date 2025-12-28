import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useThemeContext } from '../contexts/ThemeContext';

interface PageLoaderProps {
  message?: string;
}

const PageLoader: React.FC<PageLoaderProps> = ({ message = 'Загрузка...' }) => {
  const { mode } = useThemeContext();

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        background: mode === 'dark'
          ? 'rgba(0, 0, 0, 0.85)'
          : 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(30px) saturate(180%)',
        WebkitBackdropFilter: 'blur(30px) saturate(180%)',
        animation: 'fadeIn 0.3s ease-in-out',
        '@keyframes fadeIn': {
          from: {
            opacity: 0,
          },
          to: {
            opacity: 1,
          },
        },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 3,
        }}
      >
        <Box
          sx={{
            position: 'relative',
            width: 64,
            height: 64,
          }}
        >
          <CircularProgress
            size={64}
            thickness={3}
            sx={{
              color: mode === 'dark' ? '#0A84FF' : '#007AFF',
              position: 'absolute',
              animation: 'spin 1s linear infinite',
              '@keyframes spin': {
                '0%': {
                  transform: 'rotate(0deg)',
                },
                '100%': {
                  transform: 'rotate(360deg)',
                },
              },
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: mode === 'dark'
                ? 'linear-gradient(135deg, rgba(10, 132, 255, 0.2), rgba(90, 200, 250, 0.2))'
                : 'linear-gradient(135deg, rgba(0, 122, 255, 0.2), rgba(90, 200, 250, 0.2))',
              border: mode === 'dark'
                ? '1px solid rgba(10, 132, 255, 0.3)'
                : '1px solid rgba(0, 122, 255, 0.3)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
            }}
          />
        </Box>
        <Typography
          variant="h6"
          sx={{
            color: mode === 'dark' ? '#FFFFFF' : '#000000',
            fontWeight: 500,
            fontSize: '1rem',
            mt: 2,
          }}
        >
          {message}
        </Typography>
      </Box>
    </Box>
  );
};

export default PageLoader;

