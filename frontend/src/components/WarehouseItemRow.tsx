import React from 'react';
import {
  TableRow,
  TableCell,
  Checkbox,
  Typography,
  Box,
  IconButton,
  Button
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { WarehouseItem } from '../types';

interface WarehouseItemRowProps {
  item: WarehouseItem;
  isSelected: boolean;
  isMobile: boolean;
  onSelect: (id: string) => void;
  onEdit: (item: WarehouseItem) => void;
  onDelete: (id: string) => void;
}

const WarehouseItemRow: React.FC<WarehouseItemRowProps> = React.memo(({
  item,
  isSelected,
  isMobile,
  onSelect,
  onEdit,
  onDelete
}) => {
  const isLowStock = item.lowStockThreshold && item.quantity !== undefined && item.quantity <= item.lowStockThreshold;

  return (
    <TableRow 
      hover 
      selected={isSelected}
      sx={{
        backgroundColor: isSelected ? 'action.selected' : 'inherit',
        '&:hover': {
          backgroundColor: isSelected ? 'action.selected' : 'action.hover'
        }
      }}
    >
      <TableCell padding="checkbox">
        <Checkbox
          checked={isSelected}
          onChange={() => onSelect(item._id)}
        />
      </TableCell>
      <TableCell>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {item.name}
        </Typography>
        {isMobile && (
          <Box sx={{ mt: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              Артикул: {item.article || '-'} | Цена: {item.price !== undefined && item.price > 0 
                ? `${item.price.toLocaleString('ru-RU')} ₽`
                : '-'
              }
              {item.category && ` | Категория: ${item.category}`}
            </Typography>
          </Box>
        )}
      </TableCell>
      <TableCell align="right">
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
          {item.quantity !== undefined ? item.quantity : '-'}
          {isLowStock && (
            <WarningIcon sx={{ fontSize: 16, color: 'warning.main' }} />
          )}
        </Box>
      </TableCell>
      <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
        {item.article || '-'}
      </TableCell>
      <TableCell align="right" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
        {item.price !== undefined && item.price > 0 
          ? `${item.price.toLocaleString('ru-RU')} ₽`
          : '-'
        }
      </TableCell>
      <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
        {item.category || '-'}
      </TableCell>
      <TableCell align="center" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
          <IconButton 
            size="small" 
            onClick={() => onEdit(item)}
            sx={{ minWidth: 44, minHeight: 44 }}
          >
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton 
            size="small" 
            color="error" 
            onClick={() => onDelete(item._id)}
            sx={{ minWidth: 44, minHeight: 44 }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      </TableCell>
      <TableCell sx={{ display: { xs: 'table-cell', sm: 'none' } }}>
        <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column' }}>
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={() => onEdit(item)}
            fullWidth
            size="small"
            sx={{ minHeight: 36 }}
          >
            Редактировать
          </Button>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={() => onDelete(item._id)}
            fullWidth
            size="small"
            sx={{ minHeight: 36 }}
          >
            Удалить
          </Button>
        </Box>
      </TableCell>
    </TableRow>
  );
});

WarehouseItemRow.displayName = 'WarehouseItemRow';

export default WarehouseItemRow;

