import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  RadioGroup,
  FormControlLabel,
  Radio,
  Typography,
  Box,
  TextField,
  InputAdornment,
  useMediaQuery
} from '@mui/material';
import { Invoice } from '../types';
import { useThemeContext } from '../contexts/ThemeContext';

interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (type: 'selected' | 'one' | 'all', invoiceId?: string, customAmount?: number) => void;
  invoices: Invoice[];
  selectedInvoices: string[];
}

const PaymentModal: React.FC<PaymentModalProps> = ({
  open,
  onClose,
  onConfirm,
  invoices: invoicesProp,
  selectedInvoices
}) => {
  // Защита от неверного формата данных
  const invoices = Array.isArray(invoicesProp) ? invoicesProp : [];
  const { theme } = useThemeContext();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [paymentType, setPaymentType] = useState<'selected' | 'one' | 'all' | 'custom'>('selected');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('');
  const [customAmount, setCustomAmount] = useState<string>('');

  // Вычисляем общую сумму выбранных накладных
  const calculateTotalAmount = () => {
    if (paymentType === 'selected') {
      return invoices
        .filter(inv => selectedInvoices.includes(inv._id))
        .reduce((sum, inv) => {
          const amountRUB = inv.amountRUB || 0;
          return sum + (inv.type === 'return' ? -amountRUB : amountRUB);
        }, 0);
    } else if (paymentType === 'all') {
      return invoices.reduce((sum, inv) => {
        const amountRUB = inv.amountRUB || 0;
        return sum + (inv.type === 'return' ? -amountRUB : amountRUB);
      }, 0);
    } else if (paymentType === 'one' && selectedInvoiceId) {
      const invoice = invoices.find(inv => inv._id === selectedInvoiceId);
      if (invoice) {
        const amountRUB = invoice.amountRUB || 0;
        return invoice.type === 'return' ? -amountRUB : amountRUB;
      }
    }
    return 0;
  };

  const totalAmount = calculateTotalAmount();

  const handleConfirm = () => {
    if (paymentType === 'one' && !selectedInvoiceId) {
      return;
    }
    if (paymentType === 'custom' && (!customAmount || parseFloat(customAmount) <= 0)) {
      return;
    }
    const amount = paymentType === 'custom' ? parseFloat(customAmount) : undefined;
    onConfirm(paymentType === 'custom' ? 'all' : paymentType, selectedInvoiceId || undefined, amount);
    onClose();
    setPaymentType('selected');
    setSelectedInvoiceId('');
    setCustomAmount('');
  };

  const handleClose = () => {
    setPaymentType('selected');
    setSelectedInvoiceId('');
    setCustomAmount('');
    onClose();
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="sm" 
      fullWidth
      fullScreen={isMobile}
    >
      <DialogTitle>Оплата накладных</DialogTitle>
      <DialogContent>
        <RadioGroup
          value={paymentType}
          onChange={(e) => setPaymentType(e.target.value as 'selected' | 'one' | 'all' | 'custom')}
        >
          <FormControlLabel
            value="selected"
            control={<Radio />}
            label={`Оплатить выбранные (${selectedInvoices.length})`}
            disabled={selectedInvoices.length === 0}
          />
          <FormControlLabel
            value="one"
            control={<Radio />}
            label="Оплатить одну"
          />
          <FormControlLabel
            value="all"
            control={<Radio />}
            label={`Оплатить все (${invoices.length})`}
          />
          <FormControlLabel
            value="custom"
            control={<Radio />}
            label="Оплатить свою сумму"
          />
        </RadioGroup>

        {paymentType === 'one' && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Выберите накладную:
            </Typography>
            <RadioGroup
              value={selectedInvoiceId}
              onChange={(e) => setSelectedInvoiceId(e.target.value)}
            >
              {invoices.map((invoice) => (
                <FormControlLabel
                  key={invoice._id}
                  value={invoice._id}
                  control={<Radio />}
                  label={`${new Date(invoice.date).toLocaleDateString('ru-RU')} - ${typeof invoice.supplier === 'object' ? invoice.supplier.name : ''}`}
                />
              ))}
            </RadioGroup>
          </Box>
        )}

        {paymentType === 'custom' && (
          <Box sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label="Сумма оплаты"
              type="number"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              InputProps={{
                startAdornment: <InputAdornment position="start">₽</InputAdornment>
              }}
              size={isMobile ? "small" : "medium"}
              helperText={`Текущая сумма накладных: ${totalAmount.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽`}
            />
          </Box>
        )}

        {(paymentType === 'selected' || paymentType === 'all') && (
          <Box sx={{ mt: 2, p: 1.5, bgcolor: 'background.default', borderRadius: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Сумма к оплате: <strong>{totalAmount.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽</strong>
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ flexDirection: { xs: 'column', sm: 'row' }, gap: { xs: 1, sm: 0 } }}>
        <Button 
          onClick={handleClose}
          size={isMobile ? "large" : "medium"}
          fullWidth={isMobile}
          sx={{ minHeight: { xs: 44, sm: 'auto' } }}
        >
          Отмена
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          disabled={
            (paymentType === 'one' && !selectedInvoiceId) ||
            (paymentType === 'custom' && (!customAmount || parseFloat(customAmount) <= 0))
          }
          size={isMobile ? "large" : "medium"}
          fullWidth={isMobile}
          sx={{ minHeight: { xs: 44, sm: 'auto' } }}
        >
          Подтвердить
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PaymentModal;

