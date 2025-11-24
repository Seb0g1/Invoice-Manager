import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  TextField,
  Paper,
  Typography,
  CircularProgress,
  ToggleButton,
  ToggleButtonGroup,
  InputAdornment,
  useMediaQuery,
  FormControlLabel,
  Checkbox,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ru } from 'date-fns/locale';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import CurrencyRubleIcon from '@mui/icons-material/CurrencyRuble';
import api from '../services/api';
import { Supplier } from '../types';
import { useCurrencyStore } from '../store/currencyStore';
import { useThemeContext } from '../contexts/ThemeContext';
import toast from 'react-hot-toast';

interface InvoiceFormProps {
  suppliers: Supplier[];
  onSuccess: () => void;
  showSuppliersList?: boolean;
}

const InvoiceForm: React.FC<InvoiceFormProps> = ({
  suppliers,
  onSuccess,
  showSuppliersList = true
}) => {
  const [date, setDate] = useState<Date | null>(new Date());
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [newSupplierName, setNewSupplierName] = useState('');
  const [isCreatingSupplier, setIsCreatingSupplier] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [amountType, setAmountType] = useState<'USD' | 'RUB'>('RUB');
  const [amountUSD, setAmountUSD] = useState<string>('');
  const [amountRUB, setAmountRUB] = useState<string>('');
  const [hasPaidAmount, setHasPaidAmount] = useState<boolean>(false);
  const [paidAmountType, setPaidAmountType] = useState<'USD' | 'RUB'>('RUB');
  const [paidAmountUSD, setPaidAmountUSD] = useState<string>('');
  const [paidAmountRUB, setPaidAmountRUB] = useState<string>('');
  const [invoiceType, setInvoiceType] = useState<'income' | 'return'>('income');
  const [comment, setComment] = useState<string>('');
  const { rate, fetchRate } = useCurrencyStore();
  const { theme } = useThemeContext();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  useEffect(() => {
    fetchRate();
  }, [fetchRate]);

  useEffect(() => {
    // Автоматическая конвертация при изменении суммы накладной
    if (amountType === 'USD' && amountUSD && rate) {
      const usd = parseFloat(amountUSD);
      if (!isNaN(usd)) {
        setAmountRUB((usd * rate).toFixed(2));
      }
    } else if (amountType === 'RUB' && amountRUB && rate) {
      const rub = parseFloat(amountRUB);
      if (!isNaN(rub)) {
        setAmountUSD((rub / rate).toFixed(2));
      }
    }
  }, [amountType, amountUSD, amountRUB, rate]);

  useEffect(() => {
    // Автоматическая конвертация для оплаченной суммы
    if (paidAmountType === 'USD' && paidAmountUSD && rate) {
      const usd = parseFloat(paidAmountUSD);
      if (!isNaN(usd)) {
        setPaidAmountRUB((usd * rate).toFixed(2));
      }
    } else if (paidAmountType === 'RUB' && paidAmountRUB && rate) {
      const rub = parseFloat(paidAmountRUB);
      if (!isNaN(rub)) {
        setPaidAmountUSD((rub / rate).toFixed(2));
      }
    }
  }, [paidAmountType, paidAmountUSD, paidAmountRUB, rate]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      setPhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!photo) {
      toast.error('Выберите фото накладной');
      return;
    }

    if (!selectedSupplierId && !newSupplierName.trim()) {
      toast.error('Выберите или создайте поставщика');
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('photo', photo);
      formData.append('date', date?.toISOString() || new Date().toISOString());
      
      if (selectedSupplierId) {
        formData.append('supplierId', selectedSupplierId);
      } else {
        formData.append('supplierName', newSupplierName.trim());
      }

      // Добавляем тип накладной
      formData.append('type', invoiceType);

      // Добавляем комментарий, если указан
      if (comment.trim()) {
        formData.append('comment', comment.trim());
      }

      // Добавляем сумму накладной в зависимости от выбранного типа
      if (amountType === 'USD' && amountUSD) {
        formData.append('amountUSD', amountUSD);
      } else if (amountType === 'RUB' && amountRUB) {
        formData.append('amountRUB', amountRUB);
      }

      // Добавляем оплаченную сумму, если указана
      if (hasPaidAmount) {
        if (paidAmountType === 'USD' && paidAmountUSD) {
          formData.append('paidAmountUSD', paidAmountUSD);
        } else if (paidAmountType === 'RUB' && paidAmountRUB) {
          formData.append('paidAmountRUB', paidAmountRUB);
        }
        // Если указана оплаченная сумма, накладная считается оплаченной
        formData.append('paid', 'true');
      } else {
        // Если не указана оплаченная сумма, накладная не оплачена
        formData.append('paid', 'false');
      }

      await api.post('/invoices', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      toast.success('Накладная добавлена и отправлена на проверку');
      
      // Сброс формы
      setDate(new Date());
      setSelectedSupplierId('');
      setNewSupplierName('');
      setIsCreatingSupplier(false);
      setPhoto(null);
      setPhotoPreview(null);
      setAmountUSD('');
      setAmountRUB('');
      setAmountType('RUB');
      setHasPaidAmount(false);
      setPaidAmountUSD('');
      setPaidAmountRUB('');
      setPaidAmountType('RUB');
      
      onSuccess();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Ошибка при добавлении накладной');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 3 }}>
      <Typography variant="h6" gutterBottom sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
        Добавить накладную
      </Typography>
      
      <form onSubmit={handleSubmit}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Фото накладной
          </Typography>
          <Box
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            sx={{
              border: '2px dashed',
              borderColor: 'primary.main',
              borderRadius: 2,
              p: 3,
              textAlign: 'center',
              cursor: 'pointer',
              bgcolor: photoPreview ? 'transparent' : 'grey.50',
              position: 'relative'
            }}
            onClick={() => document.getElementById('photo-input')?.click()}
          >
            <input
              id="photo-input"
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              style={{ display: 'none' }}
            />
            {photoPreview ? (
              <Box>
                <img
                  src={photoPreview}
                  alt="Preview"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '300px',
                    borderRadius: '8px'
                  }}
                />
                <Button
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPhoto(null);
                    setPhotoPreview(null);
                  }}
                  sx={{ mt: 1 }}
                >
                  Удалить фото
                </Button>
              </Box>
            ) : (
              <Box>
                <CloudUploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
                <Typography>Перетащите фото сюда или нажмите для выбора</Typography>
              </Box>
            )}
          </Box>
        </Box>

        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ru}>
          <DatePicker
            label="Дата накладной"
            value={date}
            onChange={(newValue) => setDate(newValue)}
            slotProps={{
              textField: {
                fullWidth: true,
                margin: 'normal',
                required: true,
                size: isMobile ? 'small' : 'medium'
              }
            }}
          />
        </LocalizationProvider>

        <FormControl fullWidth margin="normal" size={isMobile ? 'small' : 'medium'}>
          <InputLabel>Тип накладной</InputLabel>
          <Select
            value={invoiceType}
            onChange={(e) => setInvoiceType(e.target.value as 'income' | 'return')}
            label="Тип накладной"
            inputProps={{ style: { textTransform: 'none' } }}
          >
            <MenuItem value="income">Приход</MenuItem>
            <MenuItem value="return">Возврат</MenuItem>
          </Select>
        </FormControl>

        {showSuppliersList && (
          <Box sx={{ mt: 2 }}>
            <Autocomplete<Supplier>
              fullWidth
              options={suppliers}
              getOptionLabel={(option) => option.name}
              value={
                isCreatingSupplier
                  ? null
                  : suppliers.find((s) => s._id === selectedSupplierId) || null
              }
              onChange={(_, newValue) => {
                if (newValue && newValue._id !== '__new__') {
                  // Выбран существующий поставщик
                  setIsCreatingSupplier(false);
                  setSelectedSupplierId(newValue._id);
                  setNewSupplierName('');
                } else if (newValue === null) {
                  // Очищено
                  setIsCreatingSupplier(false);
                  setSelectedSupplierId('');
                  setNewSupplierName('');
                }
              }}
              onInputChange={(_, newInputValue, reason) => {
                if (reason === 'input' && newInputValue) {
                  // Проверяем, есть ли такой поставщик в списке
                  const foundSupplier = suppliers.find(
                    (s) => s.name.toLowerCase() === newInputValue.toLowerCase()
                  );
                  
                  if (!foundSupplier && newInputValue.trim()) {
                    // Если поставщика нет в списке, разрешаем создание нового
                    setIsCreatingSupplier(true);
                    setNewSupplierName(newInputValue);
                    setSelectedSupplierId('');
                  } else if (foundSupplier) {
                    // Если нашли поставщика, выбираем его
                    setIsCreatingSupplier(false);
                    setSelectedSupplierId(foundSupplier._id);
                    setNewSupplierName('');
                  }
                } else if (reason === 'clear') {
                  setIsCreatingSupplier(false);
                  setSelectedSupplierId('');
                  setNewSupplierName('');
                }
              }}
              filterOptions={(options, { inputValue }) => {
                if (!inputValue) return options;
                const filtered = options.filter((option) =>
                  option.name.toLowerCase().includes(inputValue.toLowerCase())
                );
                // Если нет совпадений, добавляем опцию создания нового
                if (filtered.length === 0 && inputValue.trim()) {
                  return [{ _id: '__new__', name: `+ Создать "${inputValue}"`, balance: 0 } as Supplier];
                }
                return filtered;
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Поставщик"
                  margin="normal"
                  placeholder="Начните вводить название или создайте нового"
                  InputProps={{
                    ...params.InputProps,
                    style: { textTransform: 'none' }
                  }}
                  inputProps={{
                    ...params.inputProps,
                    style: { textTransform: 'none' }
                  }}
                />
              )}
              renderOption={(props, option) => {
                if (option._id === '__new__') {
                  return (
                    <li {...props} key="__new__">
                      <Typography sx={{ fontStyle: 'italic', color: 'primary.main' }}>
                        {option.name}
                      </Typography>
                    </li>
                  );
                }
                return (
                  <li {...props} key={option._id}>
                    {option.name}
                  </li>
                );
              }}
              isOptionEqualToValue={(option, value) => option._id === value._id}
              noOptionsText="Начните вводить название поставщика"
              clearOnEscape
              clearText="Очистить"
              openOnFocus
            />
          </Box>
        )}

        {isCreatingSupplier && (
          <TextField
            fullWidth
            label="Название нового поставщика"
            value={newSupplierName}
            onChange={(e) => setNewSupplierName(e.target.value)}
            margin="normal"
            required
            InputProps={{
              style: { textTransform: 'none' }
            }}
            inputProps={{
              style: { textTransform: 'none' }
            }}
          />
        )}

        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Сумма накладной (необязательно)
          </Typography>
          <ToggleButtonGroup
            value={amountType}
            exclusive
            onChange={(_, newType) => newType && setAmountType(newType)}
            fullWidth
            sx={{ mb: 2 }}
          >
            <ToggleButton value="RUB">
              <CurrencyRubleIcon sx={{ mr: 1 }} />
              Рубли
            </ToggleButton>
            <ToggleButton value="USD">
              <AttachMoneyIcon sx={{ mr: 1 }} />
              Доллары
            </ToggleButton>
          </ToggleButtonGroup>

          {amountType === 'USD' ? (
            <TextField
              fullWidth
              label="Сумма в долларах"
              type="number"
              value={amountUSD}
              onChange={(e) => setAmountUSD(e.target.value)}
              InputProps={{
                startAdornment: <InputAdornment position="start">$</InputAdornment>,
              }}
              margin="normal"
              helperText={
                amountRUB && rate
                  ? `≈ ${parseFloat(amountRUB).toLocaleString('ru-RU')} ₽ (курс: ${rate.toFixed(2)})`
                  : 'Курс обновляется автоматически'
              }
            />
          ) : (
            <TextField
              fullWidth
              label="Сумма в рублях"
              type="number"
              value={amountRUB}
              onChange={(e) => setAmountRUB(e.target.value)}
              InputProps={{
                startAdornment: <InputAdornment position="start">₽</InputAdornment>,
              }}
              margin="normal"
              helperText={
                amountUSD && rate
                  ? `≈ $${parseFloat(amountUSD).toLocaleString('ru-RU')} (курс: ${rate.toFixed(2)})`
                  : 'Курс обновляется автоматически'
              }
            />
          )}
        </Box>

        <Box sx={{ mt: 2 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={hasPaidAmount}
                onChange={(e) => setHasPaidAmount(e.target.checked)}
                color="primary"
              />
            }
            label="Указать сумму оплаты"
          />
          {hasPaidAmount && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom sx={{ mb: 1 }}>
                Оплачено (сумма может быть больше накладной → баланс будет +)
              </Typography>
              <ToggleButtonGroup
                value={paidAmountType}
                exclusive
                onChange={(_, newType) => newType && setPaidAmountType(newType)}
                fullWidth
                sx={{ mb: 2 }}
              >
                <ToggleButton value="RUB">
                  <CurrencyRubleIcon sx={{ mr: 1 }} />
                  Рубли
                </ToggleButton>
                <ToggleButton value="USD">
                  <AttachMoneyIcon sx={{ mr: 1 }} />
                  Доллары
                </ToggleButton>
              </ToggleButtonGroup>
              {paidAmountType === 'USD' ? (
                <TextField
                  fullWidth
                  label="Оплаченная сумма в долларах"
                  type="number"
                  value={paidAmountUSD}
                  onChange={(e) => setPaidAmountUSD(e.target.value)}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  }}
                  margin="normal"
                  size={isMobile ? "small" : "medium"}
                  helperText={
                    paidAmountRUB && rate
                      ? `≈ ${parseFloat(paidAmountRUB).toLocaleString('ru-RU')} ₽ (курс: ${rate.toFixed(2)})`
                      : 'Курс обновляется автоматически'
                  }
                />
              ) : (
                <TextField
                  fullWidth
                  label="Оплаченная сумма в рублях"
                  type="number"
                  value={paidAmountRUB}
                  onChange={(e) => setPaidAmountRUB(e.target.value)}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">₽</InputAdornment>,
                  }}
                  margin="normal"
                  size={isMobile ? "small" : "medium"}
                  helperText={
                    paidAmountUSD && rate
                      ? `≈ $${parseFloat(paidAmountUSD).toLocaleString('ru-RU')} (курс: ${rate.toFixed(2)})`
                      : 'Курс обновляется автоматически'
                  }
                />
              )}
            </Box>
          )}
          {!hasPaidAmount && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              Если не указана сумма оплаты, накладная будет неоплаченной (баланс увеличится на сумму накладной)
            </Typography>
          )}
        </Box>

        <TextField
          fullWidth
          label="Комментарий к накладной (необязательно)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          margin="normal"
          multiline
          rows={3}
          InputProps={{
            style: { textTransform: 'none' }
          }}
          inputProps={{
            style: { textTransform: 'none' }
          }}
        />

        <Button
          type="submit"
          variant="contained"
          fullWidth
          sx={{ mt: 3 }}
          disabled={loading}
          size={isMobile ? "large" : "medium"}
        >
          {loading ? <CircularProgress size={24} /> : 'Добавить накладную'}
        </Button>
      </form>
    </Paper>
  );
};

export default InvoiceForm;

