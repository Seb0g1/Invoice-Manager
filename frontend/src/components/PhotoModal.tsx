import React from 'react';
import {
  Dialog,
  DialogContent,
  IconButton,
  Box,
  useMediaQuery
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useThemeContext } from '../contexts/ThemeContext';

interface PhotoModalProps {
  open: boolean;
  onClose: () => void;
  photoUrl: string;
}

const PhotoModal: React.FC<PhotoModalProps> = ({ open, onClose, photoUrl }) => {
  const { theme } = useThemeContext();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  return (
    <Dialog
      open={open}
      onClose={onClose}
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
          onClick={onClose}
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            color: 'white',
            bgcolor: 'rgba(0, 0, 0, 0.5)',
            '&:hover': {
              bgcolor: 'rgba(0, 0, 0, 0.7)'
            }
          }}
        >
          <CloseIcon />
        </IconButton>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '400px',
            p: 2
          }}
        >
          <img
            src={photoUrl}
            alt="Invoice"
            style={{
              maxWidth: '100%',
              maxHeight: '80vh',
              objectFit: 'contain'
            }}
          />
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default PhotoModal;

