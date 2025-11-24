import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Typography, Container, useMediaQuery } from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import { useThemeContext } from '../contexts/ThemeContext';

const NotFound: React.FC = () => {
  const navigate = useNavigate();
  const { theme } = useThemeContext();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  return (
    <Container>
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center'
        }}
      >
        <Typography 
          variant="h1" 
          sx={{ 
            fontSize: { xs: '4rem', sm: '6rem', md: '8rem' }, 
            fontWeight: 'bold', 
            mb: 2 
          }}
        >
          404
        </Typography>
        <Typography 
          variant="h4" 
          gutterBottom
          sx={{ fontSize: { xs: '1.5rem', sm: '2rem' } }}
        >
          Страница не найдена
        </Typography>
        <Typography 
          variant="body1" 
          color="text.secondary" 
          sx={{ mb: 4, px: { xs: 2, sm: 0 } }}
        >
          Запрашиваемая страница не существует
        </Typography>
        <Button
          variant="contained"
          size={isMobile ? "large" : "large"}
          startIcon={<HomeIcon />}
          onClick={() => navigate('/')}
          sx={{ minHeight: { xs: 44, sm: 'auto' } }}
        >
          Вернуться на главную
        </Button>
      </Box>
    </Container>
  );
};

export default NotFound;

