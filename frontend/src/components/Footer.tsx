import React from 'react';
import { Box, Typography, Link } from '@mui/material';
import FavoriteIcon from '@mui/icons-material/Favorite';
import { useThemeContext } from '../contexts/ThemeContext';

const Footer: React.FC = () => {
  const { mode } = useThemeContext();

  return (
    <Box
      component="footer"
      sx={{
        py: 2,
        px: 3,
        mt: 'auto',
        textAlign: 'center',
        background: mode === 'dark'
          ? 'rgba(30, 30, 30, 0.9)'
          : 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderTop: mode === 'dark'
          ? '1px solid rgba(255, 255, 255, 0.1)'
          : '1px solid rgba(0, 0, 0, 0.1)',
      }}
    >
      <Typography
        variant="body2"
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0.5,
          color: 'text.secondary',
        }}
      >
        site development by{' '}
        <Link
          href="https://t.me/seb0g1site"
          target="_blank"
          rel="noopener noreferrer"
          sx={{
            color: 'primary.main',
            textDecoration: 'none',
            '&:hover': {
              textDecoration: 'underline',
            },
          }}
        >
          seb0g1
        </Link>
        {' '}
        <FavoriteIcon
          sx={{
            fontSize: '1rem',
            color: 'error.main',
            animation: 'pulse 2s ease-in-out infinite',
            '@keyframes pulse': {
              '0%, 100%': {
                opacity: 1,
                transform: 'scale(1)',
              },
              '50%': {
                opacity: 0.7,
                transform: 'scale(1.1)',
              },
            },
          }}
        />
      </Typography>
    </Box>
  );
};

export default Footer;

