import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Alert,
  useMediaQuery
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { useThemeContext } from '../contexts/ThemeContext';

interface DeleteConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (confirmValue: string) => void;
  type: 'supplier' | 'invoice' | 'user';
  name: string;
  confirmValue: string; // Имя поставщика, дата накладной или логин пользователя
  loading?: boolean;
}

const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  open,
  onClose,
  onConfirm,
  type,
  name,
  confirmValue,
  loading = false
}) => {
  const { mode, theme } = useThemeContext();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');

  const handleConfirm = () => {
    if (inputValue.trim() !== confirmValue) {
      setError(
        type === 'supplier'
          ? 'Имя поставщика не совпадает'
          : type === 'invoice'
          ? 'Дата накладной не совпадает'
          : 'Логин пользователя не совпадает'
      );
      return;
    }
    setError('');
    onConfirm(inputValue.trim());
  };

  const handleClose = () => {
    setInputValue('');
    setError('');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      fullScreen={isMobile}
      PaperProps={{
        sx: {
          background: mode === 'dark'
            ? 'rgba(30, 30, 30, 0.9)'
            : 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          border: mode === 'dark'
            ? '1px solid rgba(255, 255, 255, 0.1)'
            : '1px solid rgba(255, 255, 255, 0.8)',
        }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DeleteIcon color="error" />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Подтверждение удаления
          </Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Alert severity="warning" sx={{ mb: 2 }}>
          Это действие нельзя отменить. Все связанные данные будут удалены.
        </Alert>
        
        <Typography variant="body1" sx={{ mb: 2 }}>
          {type === 'supplier' ? (
            <>
              Для подтверждения удаления поставщика <strong>"{name}"</strong> введите его имя:
            </>
          ) : type === 'invoice' ? (
            <>
              Для подтверждения удаления накладной от <strong>"{name}"</strong> введите дату накладной (DD.MM.YYYY):
            </>
          ) : (
            <>
              Для подтверждения удаления пользователя <strong>"{name}"</strong> введите его логин:
            </>
          )}
        </Typography>

        <TextField
          fullWidth
          label={
            type === 'supplier' 
              ? 'Имя поставщика' 
              : type === 'invoice'
              ? 'Дата накладной (DD.MM.YYYY)'
              : 'Логин пользователя'
          }
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setError('');
          }}
          error={!!error}
          helperText={error}
          autoFocus
          size={isMobile ? "small" : "medium"}
          placeholder={
            type === 'supplier' 
              ? name 
              : type === 'invoice'
              ? 'DD.MM.YYYY'
              : name
          }
        />
      </DialogContent>
      <DialogActions sx={{ flexDirection: { xs: 'column', sm: 'row' }, gap: { xs: 1, sm: 0 } }}>
        <Button 
          onClick={handleClose} 
          disabled={loading}
          size={isMobile ? "large" : "medium"}
          fullWidth={isMobile}
          sx={{ minHeight: { xs: 44, sm: 'auto' } }}
        >
          Отмена
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          color="error"
          startIcon={<DeleteIcon />}
          disabled={loading || inputValue.trim() === ''}
          size={isMobile ? "large" : "medium"}
          fullWidth={isMobile}
          sx={{
            minHeight: { xs: 44, sm: 'auto' },
            background: 'linear-gradient(135deg, #FF3B30 0%, #FF6B6B 100%)',
            '&:hover': {
              background: 'linear-gradient(135deg, #FF6B6B 0%, #FF3B30 100%)',
            },
          }}
        >
          {loading ? 'Удаление...' : 'Удалить'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DeleteConfirmModal;

