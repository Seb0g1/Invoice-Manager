import React, { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  IconButton,
  Box,
  useMediaQuery,
  Tooltip
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import RotateLeftIcon from '@mui/icons-material/RotateLeft';
import RotateRightIcon from '@mui/icons-material/RotateRight';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import { useThemeContext } from '../contexts/ThemeContext';

interface PhotoModalProps {
  open: boolean;
  onClose: () => void;
  photoUrl: string;
}

const PhotoModal: React.FC<PhotoModalProps> = ({ open, onClose, photoUrl }) => {
  const { theme } = useThemeContext();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [rotation, setRotation] = useState(0);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const imageRef = useRef<HTMLDivElement>(null);
  
  const handleRotateLeft = () => {
    setRotation(prev => (prev - 90) % 360);
  };

  const handleRotateRight = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev * 1.2, 5)); // Максимальный зум 5x
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev / 1.2, 0.5)); // Минимальный зум 0.5x
  };

  const handleResetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale(prev => {
      const newScale = Math.max(0.5, Math.min(5, prev * delta));
      return newScale;
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (scale === 1) {
      setPosition({ x: 0, y: 0 });
    }
  }, [scale]);

  const handleClose = () => {
    setRotation(0);
    setScale(1);
    setPosition({ x: 0, y: 0 });
    onClose();
  };
  
  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="lg"
      fullWidth
      fullScreen={isMobile}
      PaperProps={{
        sx: {
          bgcolor: 'rgba(0, 0, 0, 0.9)'
        }
      }}
    >
      <DialogContent sx={{ p: 0, position: 'relative' }}>
        <IconButton
          onClick={handleClose}
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 10,
            color: 'white',
            bgcolor: 'rgba(0, 0, 0, 0.5)',
            '&:hover': {
              bgcolor: 'rgba(0, 0, 0, 0.7)'
            }
          }}
        >
          <CloseIcon />
        </IconButton>
        
        {/* Кнопки управления */}
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            left: 8,
            zIndex: 10,
            display: 'flex',
            gap: 1,
            flexWrap: 'wrap'
          }}
        >
          <Tooltip title="Повернуть против часовой стрелки">
            <IconButton
              onClick={handleRotateLeft}
              sx={{
                color: 'white',
                bgcolor: 'rgba(0, 0, 0, 0.5)',
                '&:hover': {
                  bgcolor: 'rgba(0, 0, 0, 0.7)'
                }
              }}
            >
              <RotateLeftIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Повернуть по часовой стрелке">
            <IconButton
              onClick={handleRotateRight}
              sx={{
                color: 'white',
                bgcolor: 'rgba(0, 0, 0, 0.5)',
                '&:hover': {
                  bgcolor: 'rgba(0, 0, 0, 0.7)'
                }
              }}
            >
              <RotateRightIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Увеличить">
            <IconButton
              onClick={handleZoomIn}
              sx={{
                color: 'white',
                bgcolor: 'rgba(0, 0, 0, 0.5)',
                '&:hover': {
                  bgcolor: 'rgba(0, 0, 0, 0.7)'
                }
              }}
            >
              <ZoomInIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Уменьшить">
            <IconButton
              onClick={handleZoomOut}
              sx={{
                color: 'white',
                bgcolor: 'rgba(0, 0, 0, 0.5)',
                '&:hover': {
                  bgcolor: 'rgba(0, 0, 0, 0.7)'
                }
              }}
            >
              <ZoomOutIcon />
            </IconButton>
          </Tooltip>
          {scale !== 1 && (
            <Tooltip title="Сбросить масштаб">
              <IconButton
                onClick={handleResetZoom}
                sx={{
                  color: 'white',
                  bgcolor: 'rgba(0, 0, 0, 0.5)',
                  '&:hover': {
                    bgcolor: 'rgba(0, 0, 0, 0.7)'
                  }
                }}
              >
                <Box sx={{ fontSize: '0.875rem', fontWeight: 'bold' }}>1:1</Box>
              </IconButton>
            </Tooltip>
          )}
        </Box>

        <Box
          ref={imageRef}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '400px',
            p: 2,
            overflow: 'hidden',
            cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
            userSelect: 'none'
          }}
        >
          <Box
            sx={{
              transform: `rotate(${rotation}deg) scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
              transition: isDragging ? 'none' : 'transform 0.1s ease-out',
              transformOrigin: 'center center',
              maxWidth: '100%',
              maxHeight: '80vh',
              willChange: isDragging ? 'transform' : 'auto'
            }}
          >
            <img
              src={photoUrl}
              alt="Invoice"
              draggable={false}
              style={{
                maxWidth: '100%',
                maxHeight: '80vh',
                objectFit: 'contain',
                display: 'block',
                pointerEvents: 'none'
              }}
            />
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default PhotoModal;

