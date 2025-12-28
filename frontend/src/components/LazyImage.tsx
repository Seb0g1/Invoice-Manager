import React, { useState, useEffect, useRef } from 'react';
import { Box, Skeleton, Typography } from '@mui/material';

interface LazyImageProps {
  src?: string;
  alt: string;
  width?: number | string | { xs?: number | string; sm?: number | string; md?: number | string };
  height?: number | string | { xs?: number | string; sm?: number | string; md?: number | string };
  thumbnailSrc?: string;
  sx?: any;
  onError?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
  onClick?: () => void;
}

/**
 * Компонент для ленивой загрузки изображений
 * Показывает превью (thumbnail) пока загружается полное изображение
 */
const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  width,
  height,
  thumbnailSrc,
  sx,
  onError,
  onClick
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      { rootMargin: '50px' } // Начинаем загрузку за 50px до появления в viewport
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setHasError(true);
    if (onError) {
      onError(e);
    }
  };

  // Показываем превью или skeleton пока изображение не загрузилось
  const showPlaceholder = !isLoaded && !hasError;

  // Если нет src, показываем placeholder
  if (!src) {
    return (
      <Box
        sx={{
          position: 'relative',
          width: width || '100%',
          height: height || 'auto',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'action.hover',
          color: 'text.secondary',
          ...sx
        }}
      >
        <Box sx={{ textAlign: 'center', p: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Нет фото
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      ref={imgRef}
      sx={{
        position: 'relative',
        width: width || '100%',
        height: height || 'auto',
        overflow: 'hidden',
        ...sx
      }}
    >
      {showPlaceholder && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {thumbnailSrc ? (
            <img
              src={thumbnailSrc}
              alt={alt}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                filter: 'blur(5px)',
                opacity: 0.5
              }}
            />
          ) : (
            <Skeleton variant="rectangular" width="100%" height="100%" />
          )}
        </Box>
      )}
      
      {isInView && (
        <img
          src={src}
          alt={alt}
          onLoad={handleLoad}
          onError={handleError}
          onClick={onClick}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: isLoaded ? 1 : 0,
            transition: 'opacity 0.3s ease-in-out',
            cursor: onClick ? 'pointer' : 'default'
          }}
        />
      )}

      {hasError && (
        <Box
          sx={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'action.hover',
            color: 'text.secondary'
          }}
        >
          Ошибка загрузки
        </Box>
      )}
    </Box>
  );
};

export default LazyImage;

