import React, { useState, useRef, useEffect } from 'react';
import { Box, Button, Typography, Paper, Chip, IconButton, Tooltip, useMediaQuery } from '@mui/material';
import CropFreeIcon from '@mui/icons-material/CropFree';
import DeleteIcon from '@mui/icons-material/Delete';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import FitScreenIcon from '@mui/icons-material/FitScreen';
import CropIcon from '@mui/icons-material/Crop';
import { useThemeContext } from '../contexts/ThemeContext';

interface Area {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface AreaSelectorProps {
  imageUrl: string;
  onAreasChange: (areas: Area[]) => void;
  maxAreas?: number;
  rotation?: number;
}

const AreaSelector: React.FC<AreaSelectorProps> = ({ 
  imageUrl, 
  onAreasChange, 
  maxAreas = 2,
  rotation = 0
}) => {
  const { theme } = useThemeContext();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [areas, setAreas] = useState<Area[]>([]);
  const [isSelecting, setIsSelecting] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentArea, setCurrentArea] = useState<Area | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const [imageDisplaySize, setImageDisplaySize] = useState({ width: 0, height: 0 });
  const [zoomScale, setZoomScale] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const prevRotationRef = useRef(rotation);

  // Сбрасываем области при изменении поворота
  useEffect(() => {
    if (prevRotationRef.current !== rotation) {
      setAreas([]);
      setZoomScale(1);
      setPanOffset({ x: 0, y: 0 });
      onAreasChange([]);
      prevRotationRef.current = rotation;
    }
  }, [rotation, onAreasChange]);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.clientWidth - 32; // минус padding
        const containerHeight = 500;
        
        // Учитываем поворот при расчете размеров
        let imgWidth = img.width;
        let imgHeight = img.height;
        if (rotation === 90 || rotation === -90 || rotation === 270 || rotation === -270) {
          [imgWidth, imgHeight] = [imgHeight, imgWidth];
        }
        
        const imgAspect = imgWidth / imgHeight;
        const containerAspect = containerWidth / containerHeight;

        let displayWidth = containerWidth;
        let displayHeight = containerHeight;

        if (imgAspect > containerAspect) {
          displayHeight = displayWidth / imgAspect;
        } else {
          displayWidth = displayHeight * imgAspect;
        }

        setImageDisplaySize({ width: displayWidth, height: displayHeight });
      }
    };
    img.src = imageUrl;
  }, [imageUrl, rotation]);

  // Преобразует координаты мыши/тача в координаты изображения
  const getImageCoordinates = (clientX: number, clientY: number): { x: number; y: number } => {
    if (!imageContainerRef.current || !containerRef.current || imageDisplaySize.width === 0) {
      return { x: 0, y: 0 };
    }
    
    const containerRect = containerRef.current.getBoundingClientRect();
    
    // Координаты мыши/тача относительно контейнера
    const mouseX = clientX - containerRect.left;
    const mouseY = clientY - containerRect.top;
    
    // Координаты центра доступной области
    const centerX = containerRect.width / 2;
    const centerY = containerRect.height / 2;
    
    // Координаты относительно центра
    const relativeX = mouseX - centerX;
    const relativeY = mouseY - centerY;
    
    // Учитываем панорамирование и зум
    const imageX = (relativeX - panOffset.x) / zoomScale;
    const imageY = (relativeY - panOffset.y) / zoomScale;
    
    // Переводим в координаты изображения (изображение центрировано)
    const x = imageX + imageDisplaySize.width / 2;
    const y = imageY + imageDisplaySize.height / 2;
    
    // Ограничиваем координаты границами изображения
    return {
      x: Math.max(0, Math.min(x, imageDisplaySize.width)),
      y: Math.max(0, Math.min(y, imageDisplaySize.height))
    };
  };

  // Функция для выбора всей области (для мобильных устройств)
  const handleSelectFullArea = () => {
    if (areas.length >= maxAreas || imageDisplaySize.width === 0) return;
    
    const fullArea: Area = {
      id: Date.now(),
      x: 0,
      y: 0,
      width: imageDisplaySize.width,
      height: imageDisplaySize.height
    };
    
    const newAreas = [...areas, fullArea];
    setAreas(newAreas);
    onAreasChange(newAreas);
  };

  const handleStart = (clientX: number, clientY: number, target: HTMLElement) => {
    // Если клик на кнопке удаления или на области, не обрабатываем
    if (target.closest('.area-box') || target.closest('button')) {
      return;
    }

    if (areas.length >= maxAreas) {
      return;
    }
    
    const pos = getImageCoordinates(clientX, clientY);
    setIsSelecting(true);
    setStartPos(pos);
    setCurrentArea({
      id: Date.now(),
      x: pos.x,
      y: pos.y,
      width: 0,
      height: 0
    });
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!isSelecting || !currentArea) return;

    const pos = getImageCoordinates(clientX, clientY);
    const width = pos.x - startPos.x;
    const height = pos.y - startPos.y;

    setCurrentArea({
      ...currentArea,
      width,
      height
    });
  };

  const handleEnd = () => {
    setIsDragging(false);
    
    if (!isSelecting || !currentArea) {
      setIsSelecting(false);
      setCurrentArea(null);
      return;
    }

    // Проверяем, что область достаточно большая
    if (Math.abs(currentArea.width) > 20 && Math.abs(currentArea.height) > 20) {
      // Нормализуем координаты
      const normalizedArea: Area = {
        id: currentArea.id,
        x: currentArea.width < 0 ? currentArea.x + currentArea.width : currentArea.x,
        y: currentArea.height < 0 ? currentArea.y + currentArea.height : currentArea.y,
        width: Math.abs(currentArea.width),
        height: Math.abs(currentArea.height)
      };

      // Проверяем границы
      normalizedArea.x = Math.max(0, Math.min(normalizedArea.x, imageDisplaySize.width));
      normalizedArea.y = Math.max(0, Math.min(normalizedArea.y, imageDisplaySize.height));
      normalizedArea.width = Math.min(normalizedArea.width, imageDisplaySize.width - normalizedArea.x);
      normalizedArea.height = Math.min(normalizedArea.height, imageDisplaySize.height - normalizedArea.y);

      if (normalizedArea.width > 10 && normalizedArea.height > 10) {
        const newAreas = [...areas, normalizedArea];
        setAreas(newAreas);
        onAreasChange(newAreas);
      }
    }

    setIsSelecting(false);
    setCurrentArea(null);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Если зажат Shift или мы в режиме зума, включаем перетаскивание
    if (e.shiftKey || (zoomScale > 1 && !isSelecting)) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - panOffset.x,
        y: e.clientY - panOffset.y
      });
      return;
    }

    handleStart(e.clientX, e.clientY, e.target as HTMLElement);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging && zoomScale > 1) {
      setPanOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
      return;
    }

    handleMove(e.clientX, e.clientY);
  };

  const handleMouseUp = (e?: React.MouseEvent<HTMLDivElement>) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    handleEnd();
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.touches.length !== 1) return; // Только одно касание
    
    const touch = e.touches[0];
    handleStart(touch.clientX, touch.clientY, e.target as HTMLElement);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.touches.length !== 1) return; // Только одно касание
    
    const touch = e.touches[0];
    handleMove(touch.clientX, touch.clientY);
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    handleEnd();
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Зум по колесику мыши
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.5, Math.min(5, zoomScale * delta));
    
    if (newScale === 1) {
      setPanOffset({ x: 0, y: 0 });
    }
    
    setZoomScale(newScale);
  };

  const handleZoomIn = () => {
    const newScale = Math.min(zoomScale * 1.2, 5);
    if (newScale === 1) {
      setPanOffset({ x: 0, y: 0 });
    }
    setZoomScale(newScale);
  };

  const handleZoomOut = () => {
    const newScale = Math.max(zoomScale / 1.2, 0.5);
    if (newScale === 1) {
      setPanOffset({ x: 0, y: 0 });
    }
    setZoomScale(newScale);
  };

  const handleResetZoom = () => {
    setZoomScale(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const handleDeleteArea = (id: number) => {
    const newAreas = areas.filter(area => area.id !== id);
    setAreas(newAreas);
    onAreasChange(newAreas);
  };

  return (
    <Box>
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1, minWidth: { xs: '100%', sm: 'auto' } }}>
          {areas.length === 0 
            ? isMobile
              ? `Нажмите "Выбрать всю область" или перетащите пальцем на изображении, чтобы выбрать область с суммой.`
              : `Нажмите и перетащите мышью на изображении, чтобы выбрать область с суммой. Можно выбрать до ${maxAreas} областей.`
            : areas.length < maxAreas
            ? `Выбрано областей: ${areas.length}/${maxAreas}. Выберите еще область или нажмите "Распознать суммы".`
            : `Выбрано максимальное количество областей (${maxAreas}). Нажмите "Распознать суммы".`
          }
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
          {isMobile && areas.length < maxAreas && (
            <Tooltip title="Выбрать всю область изображения">
              <Button
                size="small"
                variant="outlined"
                startIcon={<CropIcon />}
                onClick={handleSelectFullArea}
                sx={{ mr: 0.5 }}
              >
                Вся область
              </Button>
            </Tooltip>
          )}
          <Tooltip title="Приблизить">
            <IconButton size="small" onClick={handleZoomIn} disabled={zoomScale >= 5}>
              <ZoomInIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Отдалить">
            <IconButton size="small" onClick={handleZoomOut} disabled={zoomScale <= 0.5}>
              <ZoomOutIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Сбросить масштаб">
            <IconButton size="small" onClick={handleResetZoom} disabled={zoomScale === 1}>
              <FitScreenIcon />
            </IconButton>
          </Tooltip>
          {zoomScale !== 1 && (
            <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5, minWidth: 40 }}>
              {Math.round(zoomScale * 100)}%
            </Typography>
          )}
        </Box>
      </Box>

      {areas.length > 0 && (
        <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          {areas.map((area, index) => (
            <Chip
              key={area.id}
              icon={<CropFreeIcon />}
              label={`Область ${index + 1}`}
              onDelete={() => handleDeleteArea(area.id)}
              color="primary"
              variant="outlined"
            />
          ))}
        </Box>
      )}
      
      <Paper
        ref={containerRef}
        onWheel={handleWheel}
        sx={{
          position: 'relative',
          width: '100%',
          height: '500px',
          overflow: 'hidden',
          border: '2px dashed',
          borderColor: 'primary.main',
          bgcolor: 'background.paper',
          p: 2,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          cursor: zoomScale > 1 ? (isDragging ? 'grabbing' : 'grab') : (areas.length >= maxAreas ? 'default' : 'crosshair')
        }}
      >
        <Box
          ref={imageContainerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => handleMouseUp()}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          sx={{
            position: 'relative',
            width: imageDisplaySize.width,
            height: imageDisplaySize.height,
            userSelect: 'none',
            transform: `scale(${zoomScale}) translate(${panOffset.x / zoomScale}px, ${panOffset.y / zoomScale}px)`,
            transformOrigin: 'center center',
            transition: isDragging || isSelecting ? 'none' : 'transform 0.1s ease-out'
          }}
        >
          <img
            src={imageUrl}
            alt="Invoice"
            style={{
              width: '100%',
              height: '100%',
              display: 'block',
              pointerEvents: 'none',
              objectFit: 'contain',
              transform: `rotate(${rotation}deg)`,
              transition: 'transform 0.3s ease-in-out'
            }}
          />

          {/* Отображаем выбранные области */}
          {areas.map((area) => (
            <Box
              key={area.id}
              className="area-box"
              sx={{
                position: 'absolute',
                left: area.x,
                top: area.y,
                width: area.width,
                height: area.height,
                border: '3px solid',
                borderColor: 'primary.main',
                bgcolor: 'rgba(25, 118, 210, 0.15)',
                pointerEvents: 'none',
                '&:hover': {
                  bgcolor: 'rgba(25, 118, 210, 0.25)',
                  borderColor: 'primary.dark'
                }
              }}
            >
              <Button
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  handleDeleteArea(area.id);
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                sx={{
                  position: 'absolute',
                  top: -12,
                  right: -12,
                  minWidth: 'auto',
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  bgcolor: 'error.main',
                  color: 'white',
                  boxShadow: 2,
                  zIndex: 10,
                  pointerEvents: 'auto',
                  '&:hover': {
                    bgcolor: 'error.dark',
                    transform: 'scale(1.1)'
                  },
                  transition: 'all 0.2s'
                }}
              >
                <DeleteIcon sx={{ fontSize: 18 }} />
              </Button>
            </Box>
          ))}

          {/* Отображаем текущую выбираемую область */}
          {currentArea && (
            <Box
              sx={{
                position: 'absolute',
                left: currentArea.width < 0 ? currentArea.x + currentArea.width : currentArea.x,
                top: currentArea.height < 0 ? currentArea.y + currentArea.height : currentArea.y,
                width: Math.abs(currentArea.width),
                height: Math.abs(currentArea.height),
                border: '2px dashed',
                borderColor: 'secondary.main',
                bgcolor: 'rgba(156, 39, 176, 0.1)',
                pointerEvents: 'none'
              }}
            />
          )}
        </Box>
      </Paper>
    </Box>
  );
};

export default AreaSelector;
export type { Area };
