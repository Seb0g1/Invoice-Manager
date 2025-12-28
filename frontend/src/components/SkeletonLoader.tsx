import React from 'react';
import { Box, Skeleton, useMediaQuery } from '@mui/material';
import { useThemeContext } from '../contexts/ThemeContext';

interface SkeletonLoaderProps {
  variant?: 'table' | 'list' | 'card' | 'text';
  rows?: number;
  columns?: number;
}

const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({ 
  variant = 'text', 
  rows = 3,
  columns = 1 
}) => {
  const { theme } = useThemeContext();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  if (variant === 'table') {
    return (
      <Box>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <Box key={rowIndex} sx={{ display: 'flex', gap: 2, mb: 2 }}>
            {Array.from({ length: columns }).map((_, colIndex) => (
              <Skeleton
                key={colIndex}
                variant="rectangular"
                width={isMobile ? '100%' : `${100 / columns}%`}
                height={40}
                sx={{ borderRadius: 1 }}
              />
            ))}
          </Box>
        ))}
      </Box>
    );
  }

  if (variant === 'list') {
    return (
      <Box>
        {Array.from({ length: rows }).map((_, index) => (
          <Box key={index} sx={{ mb: 2 }}>
            <Skeleton variant="rectangular" width="100%" height={60} sx={{ borderRadius: 1 }} />
          </Box>
        ))}
      </Box>
    );
  }

  if (variant === 'card') {
    return (
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 2 }}>
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton
            key={index}
            variant="rectangular"
            width="100%"
            height={200}
            sx={{ borderRadius: 2 }}
          />
        ))}
      </Box>
    );
  }

  // Default: text
  return (
    <Box>
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton
          key={index}
          variant="text"
          width={index === rows - 1 ? '60%' : '100%'}
          height={24}
          sx={{ mb: 1 }}
        />
      ))}
    </Box>
  );
};

export default SkeletonLoader;

