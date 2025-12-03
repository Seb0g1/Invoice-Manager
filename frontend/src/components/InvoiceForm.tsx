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
  Autocomplete,
  IconButton,
  Tooltip
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ru } from 'date-fns/locale';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import CurrencyRubleIcon from '@mui/icons-material/CurrencyRuble';
import RotateLeftIcon from '@mui/icons-material/RotateLeft';
import RotateRightIcon from '@mui/icons-material/RotateRight';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CropFreeIcon from '@mui/icons-material/CropFree';
import api from '../services/api';
import { Supplier } from '../types';
import { useCurrencyStore } from '../store/currencyStore';
import { useThemeContext } from '../contexts/ThemeContext';
import toast from 'react-hot-toast';
import { createWorker } from 'tesseract.js';
import AreaSelector, { Area } from './AreaSelector';

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
  const [photoRotation, setPhotoRotation] = useState(0);
  const [loading, setLoading] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const [selectedAreas, setSelectedAreas] = useState<Area[]>([]);
  const [showAreaSelector, setShowAreaSelector] = useState(false);
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

  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });


  // Функция для оптимизации изображения для мобильных устройств
  const optimizeImageForMobile = async (file: File, maxWidth: number = 1200): Promise<File> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Не удалось получить контекст canvas'));
          return;
        }

        // Вычисляем новый размер
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        // Рисуем изображение с новым размером
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          if (blob) {
            const optimizedFile = new File([blob], file.name, { type: 'image/jpeg' });
            console.log('[OCR] Изображение оптимизировано:', file.size, '->', optimizedFile.size);
            resolve(optimizedFile);
          } else {
            reject(new Error('Не удалось создать blob'));
          }
        }, 'image/jpeg', 0.85); // Качество 85%
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  };

  // Функция для обрезки изображения по области
  const cropImageToArea = async (imageFile: File, area: Area, displaySize: { width: number; height: number }, rotation: number = 0): Promise<File> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Не удалось получить контекст canvas'));
          return;
        }

        // Получаем реальные размеры изображения
        let imgWidth = img.width;
        let imgHeight = img.height;
        
        // Учитываем поворот при расчете размеров
        if (rotation === 90 || rotation === -90 || rotation === 270 || rotation === -270) {
          [imgWidth, imgHeight] = [imgHeight, imgWidth];
        }
        
        // Вычисляем масштаб
        const scaleX = imgWidth / displaySize.width;
        const scaleY = imgHeight / displaySize.height;

        console.log('[Crop] Область:', area);
        console.log('[Crop] Размер отображения:', displaySize);
        console.log('[Crop] Реальный размер изображения:', { width: img.width, height: img.height });
        console.log('[Crop] Масштаб:', { scaleX, scaleY });
        console.log('[Crop] Поворот:', rotation);

        // Пересчитываем координаты в реальные размеры изображения
        let realX = area.x * scaleX;
        let realY = area.y * scaleY;
        let realWidth = area.width * scaleX;
        let realHeight = area.height * scaleY;

        // Учитываем поворот при обрезке
        if (rotation !== 0) {
          // Поворачиваем координаты области
          if (rotation === 90 || rotation === -270) {
            // Поворот на 90° по часовой стрелке
            const tempX = realX;
            realX = img.height - realY - realHeight;
            realY = tempX;
            [realWidth, realHeight] = [realHeight, realWidth];
          } else if (rotation === -90 || rotation === 270) {
            // Поворот на 90° против часовой стрелки
            const tempX = realX;
            realX = realY;
            realY = img.width - tempX - realWidth;
            [realWidth, realHeight] = [realHeight, realWidth];
          } else if (rotation === 180 || rotation === -180) {
            // Поворот на 180°
            realX = img.width - realX - realWidth;
            realY = img.height - realY - realHeight;
          }
        }

        // Ограничиваем координаты границами изображения
        realX = Math.max(0, Math.min(realX, img.width - 1));
        realY = Math.max(0, Math.min(realY, img.height - 1));
        realWidth = Math.max(1, Math.min(realWidth, img.width - realX));
        realHeight = Math.max(1, Math.min(realHeight, img.height - realY));

        console.log('[Crop] Финальные координаты:', { realX, realY, realWidth, realHeight });

        canvas.width = realWidth;
        canvas.height = realHeight;

        // Если есть поворот, сначала поворачиваем изображение
        if (rotation !== 0) {
          const fullCanvas = document.createElement('canvas');
          fullCanvas.width = img.width;
          fullCanvas.height = img.height;
          const fullCtx = fullCanvas.getContext('2d');
          if (!fullCtx) {
            reject(new Error('Не удалось создать контекст для поворота'));
            return;
          }
          
          // Поворачиваем изображение
          fullCtx.translate(img.width / 2, img.height / 2);
          fullCtx.rotate((rotation * Math.PI) / 180);
          fullCtx.drawImage(img, -img.width / 2, -img.height / 2);
          
          // Обрезаем из повернутого изображения
          ctx.drawImage(
            fullCanvas,
            realX, realY, realWidth, realHeight,
            0, 0, realWidth, realHeight
          );
        } else {
          ctx.drawImage(
            img,
            realX, realY, realWidth, realHeight,
            0, 0, realWidth, realHeight
          );
        }

        canvas.toBlob((blob) => {
          if (blob) {
            console.log('[Crop] Обрезанное изображение создано, размер:', blob.size);
            const file = new File([blob], 'cropped-area.png', { type: 'image/png' });
            resolve(file);
          } else {
            reject(new Error('Не удалось создать blob'));
          }
        }, 'image/png');
      };
      img.onerror = (error) => {
        console.error('[Crop] Ошибка загрузки изображения:', error);
        reject(error);
      };
      img.src = URL.createObjectURL(imageFile);
    });
  };

  // Функция для распознавания суммы с фото (может работать с обрезанным изображением)
  const recognizeAmount = async (imageFile: File): Promise<number | null> => {
    try {
      console.log('[OCR] Начало распознавания, размер файла:', imageFile.size, 'тип:', imageFile.type);
      
      // Проверяем, поддерживается ли WebAssembly (необходимо для tesseract.js)
      if (typeof WebAssembly === 'undefined') {
        toast.error('Ваш браузер не поддерживает распознавание текста. Пожалуйста, используйте современный браузер.');
        return null;
      }
      
      setRecognizing(true);
      
      // На мобильных устройствах показываем предупреждение о времени обработки
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      // Оптимизируем изображение для мобильных устройств (уменьшаем размер для ускорения)
      let imageToRecognize = imageFile;
      if (isMobileDevice && imageFile.size > 500000) { // Если файл больше 500KB
        console.log('[OCR] Оптимизация изображения для мобильного устройства...');
        imageToRecognize = await optimizeImageForMobile(imageFile);
        toast.loading('Распознавание текста на мобильном устройстве может занять больше времени...', { id: 'ocr-mobile' });
      } else if (isMobileDevice) {
        toast.loading('Распознавание текста...', { id: 'ocr-mobile' });
      }
      
      const worker = await createWorker('rus+eng', 1, {
        logger: (m: any) => {
          if (m.status === 'recognizing text') {
            const progress = Math.round(m.progress * 100);
            if (isMobileDevice) {
              toast.loading(`Распознавание: ${progress}%`, { id: 'ocr-mobile' });
            }
          }
        }
      });
      
      console.log('[OCR] Worker создан, начинаю распознавание...');
      // Распознаем текст с изображения
      const { data: { text } } = await worker.recognize(imageToRecognize);
      await worker.terminate();
      
      if (isMobileDevice) {
        toast.dismiss('ocr-mobile');
      }

      console.log('[OCR] Распознанный текст:', text);
      console.log('[OCR] Длина текста:', text.length);

      // Проверяем, что текст не пустой
      if (!text || text.trim().length === 0) {
        console.log('[OCR] ❌ Текст не распознан (пустой)');
        toast.error('Не удалось распознать текст с изображения. Убедитесь, что фото четкое и содержит текст.');
        return null;
      }

      if (text.trim().length < 10) {
        console.log('[OCR] ⚠️ Распознано очень мало текста:', text);
        toast.error('Распознано слишком мало текста. Убедитесь, что фото четкое и содержит текст накладной.');
      }

      // Нормализуем текст: приводим к нижнему регистру и заменяем похожие символы
      const normalizedText = text
        .toLowerCase()
        .replace(/[|1]/g, 'I') // Заменяем похожие символы на I
        .replace(/[0О]/g, 'O') // Заменяем 0 и О на O
        .replace(/[а]/g, 'a') // Кириллица и латиница
        .replace(/\s+/g, ' '); // Нормализуем пробелы

      // Ищем слово "Итого" (разные варианты написания, включая возможные ошибки OCR)
      // OCR может путать буквы: И->I, т->т, о->о, г->г
      // Приоритет: сначала ищем более специфичные паттерны
      const итогоPatterns = [
        /итого\s*:/gi, // итого: (самый специфичный)
        /итого/gi,
        /итог\s*:/gi, // итог:
        /итог[оа]/gi, // итого или итога
        /total\s*:/gi, // total: (специфичный)
        /total/gi,
        /сумма\s+к\s+оплате/gi, // сумма к оплате
        /к\s+оплате/gi, // к оплате
        /всего\s+на\s+сумму/gi, // "Всего на сумму"
        /на\s+сумму/gi, // "на сумму"
        // Менее специфичные - в конце
        /сумма/gi,
        /всего/gi, // "Всего" тоже может быть (но может быть в таблице товаров)
      ];

      let итогоИндекс = -1;
      let итогоТекст = '';

      // Сначала ищем в нормализованном тексте
      for (const pattern of итогоPatterns) {
        const match = normalizedText.match(pattern);
        if (match) {
          // Находим позицию в оригинальном тексте
          const normalizedIndex = normalizedText.indexOf(match[0]);
          // Приблизительно находим в оригинале (может быть небольшая погрешность)
          итогоИндекс = Math.max(0, normalizedIndex - 10);
          итогоТекст = match[0];
          console.log('[OCR] Найдено ключевое слово:', match[0], 'на позиции', итогоИндекс);
          break;
        }
      }

      // Если не нашли в нормализованном, ищем в оригинальном
      if (итогоИндекс === -1) {
        for (const pattern of итогоPatterns) {
          const match = text.match(pattern);
          if (match) {
            итогоИндекс = text.indexOf(match[0]);
            итогоТекст = match[0];
            console.log('[OCR] Найдено ключевое слово (оригинал):', match[0], 'на позиции', итогоИндекс);
            break;
          }
        }
      }

      // Если не нашли "Итого", ищем суммы в конце документа (обычно там итоговая сумма)
      let searchArea = '';
      if (итогоИндекс !== -1) {
        // Извлекаем текст после "Итого" (берем больше текста для поиска)
        searchArea = text.substring(итогоИндекс, итогоИндекс + 300);
        console.log('[OCR] Текст после ключевого слова:', searchArea);
      } else {
        // Если не нашли "Итого", ищем в последней трети текста (обычно там итоговая сумма)
        const lastThird = Math.floor(text.length / 3) * 2;
        searchArea = text.substring(lastThird);
        console.log('[OCR] "Итого" не найдено, ищем в конце документа (последняя треть):');
        console.log('[OCR] Текст для поиска:', searchArea.substring(0, 300));
      }
      
      // Ищем числа в тексте - более гибкие паттерны
      // Сначала ищем суммы с валютой (более точные)
      const amountPatternsWithCurrency = [
        /(\d{1,6}[.,]\d{2})\s*(?:usd|\$|долл|долларов)/i, // 89.00 USD или 89,00$
        /(?:usd|\$|долл|долларов)\s*(\d{1,6}[.,]\d{2})/i, // USD 89.00 или $89,00
        /(\d{1,6}[.,]\d{2})\s*(?:rub|₽|руб|рублей)/i, // 89.00 RUB
        /(?:rub|₽|руб|рублей)\s*(\d{1,6}[.,]\d{2})/i, // RUB 89.00
      ];

      // Затем ищем просто числа с десятичными знаками
      const amountPatterns = [
        /(\d{1,6}[.,]\d{2})/g, // 89.00 или 89,45
        /(\d{1,6}[.,]\d{1})/g, // 89.0 или 89,4
      ];

      const foundAmounts: number[] = [];
      const foundAmountsWithContext: Array<{ amount: number; context: string; index: number }> = [];

      // Сначала ищем суммы с валютой (приоритет)
      for (const pattern of amountPatternsWithCurrency) {
        const matches = searchArea.matchAll(new RegExp(pattern, 'gi'));
        for (const match of matches) {
          const amountStr = (match[1] || match[0]).replace(/\s/g, '').replace(/[^\d.,]/g, '');
          const amount = parseFloat(amountStr.replace(',', '.'));
          
          if (!isNaN(amount) && amount >= 1 && amount < 1000000) {
            const matchIndex = match.index || 0;
            const contextStart = Math.max(0, matchIndex - 20);
            const contextEnd = Math.min(searchArea.length, matchIndex + match[0].length + 20);
            const context = searchArea.substring(contextStart, contextEnd).toLowerCase();
            
            foundAmounts.push(amount);
            foundAmountsWithContext.push({
              amount,
              context,
              index: matchIndex
            });
            console.log('[OCR] Найдена сумма с валютой:', amount, 'контекст:', context);
          }
        }
      }

      // Если не нашли суммы с валютой, ищем просто числа
      if (foundAmounts.length === 0) {
        for (const pattern of amountPatterns) {
          const matches = searchArea.matchAll(new RegExp(pattern, 'gi'));
          for (const match of matches) {
            const amountStr = (match[1] || match[0]).replace(/\s/g, '').replace(/[^\d.,]/g, '');
            const amount = parseFloat(amountStr.replace(',', '.'));
            
            // Фильтруем: сумма должна быть разумной
            if (!isNaN(amount) && amount >= 0.01 && amount < 1000000) {
              const matchIndex = match.index || 0;
              const contextStart = Math.max(0, matchIndex - 30);
              const contextEnd = Math.min(searchArea.length, matchIndex + match[0].length + 30);
              const context = searchArea.substring(contextStart, contextEnd).toLowerCase();
              
              // Игнорируем суммы, которые находятся рядом с названиями товаров
              // (обычно в таблице товаров есть слова типа "шт", "ед", "название", "товар")
              const isInProductTable = /(шт|ед|название|товар|артикул|кол-во|количество|цена|сумма\s*$)/i.test(context);
              
              // Игнорируем очень маленькие суммы (меньше 1), которые могут быть ценами за единицу
              if (amount < 1 && isInProductTable) {
                console.log('[OCR] Пропущена сумма в таблице товаров:', amount);
                continue;
              }
              
              foundAmounts.push(amount);
              foundAmountsWithContext.push({
                amount,
                context,
                index: matchIndex
              });
            }
          }
        }
      }

      // Убираем дубликаты и сортируем по убыванию
      const uniqueAmounts = [...new Set(foundAmounts)].sort((a, b) => b - a);
      console.log('[OCR] Все найденные суммы:', uniqueAmounts);
      console.log('[OCR] Суммы с контекстом:', foundAmountsWithContext);

      if (uniqueAmounts.length > 0) {
        // Если нашли "Итого", ищем сумму сразу после него
        if (итогоИндекс !== -1) {
          // Ищем сумму, которая находится ближе всего к "Итого" и после него
          const amountsAfterИтого = foundAmountsWithContext
            .filter(item => item.index > итогоИндекс)
            .sort((a, b) => {
              // Сначала по близости к "Итого"
              const distanceA = a.index - итогоИндекс;
              const distanceB = b.index - итогоИндекс;
              if (Math.abs(distanceA - distanceB) < 50) {
                // Если близко, берем большую сумму
                return b.amount - a.amount;
              }
              return distanceA - distanceB;
            });
          
          if (amountsAfterИтого.length > 0) {
            const selectedAmount = amountsAfterИтого[0].amount;
            console.log('[OCR] ✅ Выбрана сумма после "Итого":', selectedAmount);
            return selectedAmount;
          }
        }
        
        // Если не нашли "Итого" или сумму после него, берем наибольшую сумму
        // Но предпочитаем суммы, которые не в таблице товаров
        const amountsNotInTable = foundAmountsWithContext
          .filter(item => !/(шт|ед|название|товар|артикул)/i.test(item.context))
          .map(item => item.amount)
          .sort((a, b) => b - a);
        
        if (amountsNotInTable.length > 0) {
          const selectedAmount = amountsNotInTable[0];
          console.log('[OCR] ✅ Выбрана наибольшая сумма (не в таблице):', selectedAmount);
          return selectedAmount;
        }
        
        // Если все суммы в таблице, берем наибольшую
        const selectedAmount = uniqueAmounts[0];
        console.log('[OCR] ✅ Выбрана наибольшая сумма:', selectedAmount);
        return selectedAmount;
      }

      // Если ничего не нашли в searchArea, попробуем поискать во всем тексте
      console.log('[OCR] Не найдено в области поиска, ищем во всем тексте...');
      const allTextMatches = text.matchAll(/(\d{1,6}[.,]\d{2})\s*(?:usd|\$|долл)/gi);
      const allAmounts: number[] = [];
      for (const match of allTextMatches) {
        const amountStr = match[1].replace(/\s/g, '').replace(',', '.');
        const amount = parseFloat(amountStr);
        if (!isNaN(amount) && amount >= 1 && amount < 1000000) {
          allAmounts.push(amount);
        }
      }
      
      if (allAmounts.length > 0) {
        const maxAmount = Math.max(...allAmounts);
        console.log('[OCR] ✅ Найдена сумма во всем тексте:', maxAmount);
        return maxAmount;
      }

      console.log('[OCR] ❌ Сумма не найдена');
      return null;
    } catch (error: any) {
      console.error('[OCR] Ошибка распознавания:', error);
      toast.error('Ошибка при распознавании суммы с фото');
      return null;
    } finally {
      setRecognizing(false);
    }
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhoto(file);
      setPhotoRotation(0);
      setSelectedAreas([]);
      setShowAreaSelector(true);
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

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      setPhoto(file);
      setPhotoRotation(0);
      setSelectedAreas([]);
      setShowAreaSelector(true);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
        // Определяем размер изображения для масштабирования
        const img = new Image();
        img.onload = () => {
          const containerWidth = 800;
          const containerHeight = 600;
          const imgAspect = img.width / img.height;
          const containerAspect = containerWidth / containerHeight;
          
          let displayWidth = img.width;
          let displayHeight = img.height;

          if (imgAspect > containerAspect) {
            displayWidth = containerWidth;
            displayHeight = containerWidth / imgAspect;
          } else {
            displayHeight = containerHeight;
            displayWidth = containerHeight * imgAspect;
          }

          setImageSize({ width: displayWidth, height: displayHeight });
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  // Функция для распознавания сумм из выбранных областей
  const recognizeAmountsFromAreas = async () => {
    if (!photo || selectedAreas.length === 0) {
      toast.error('Выберите области с суммами на накладной');
      return;
    }

    try {
      setRecognizing(true);
      const amounts: number[] = [];

      // Получаем реальный размер изображения для правильного масштабирования
      const img = new Image();
      const imgSize = await new Promise<{ width: number; height: number }>((resolve, reject) => {
        img.onload = () => {
          // Вычисляем размер отображения (как в AreaSelector)
          const containerWidth = 800 - 32; // минус padding
          const containerHeight = 500;
          
          // Учитываем поворот при расчете размеров
          let imgWidth = img.width;
          let imgHeight = img.height;
          if (photoRotation === 90 || photoRotation === -90 || photoRotation === 270 || photoRotation === -270) {
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

          console.log('[Recognize] Размер изображения:', { width: img.width, height: img.height });
          console.log('[Recognize] Размер с учетом поворота:', { width: imgWidth, height: imgHeight });
          console.log('[Recognize] Размер отображения:', { width: displayWidth, height: displayHeight });
          console.log('[Recognize] Поворот:', photoRotation);

          resolve({ width: displayWidth, height: displayHeight });
        };
        img.onerror = reject;
        img.src = photoPreview || URL.createObjectURL(photo);
      });

      for (let i = 0; i < selectedAreas.length; i++) {
        const area = selectedAreas[i];
        console.log(`[Recognize] Обработка области ${i + 1}/${selectedAreas.length}:`, area);
        
        try {
          const croppedFile = await cropImageToArea(photo, area, imgSize, photoRotation);
          console.log(`[Recognize] Область ${i + 1} обрезана, размер файла:`, croppedFile.size);
          
          const amount = await recognizeAmount(croppedFile);
          if (amount) {
            console.log(`[Recognize] Область ${i + 1}: распознана сумма`, amount);
            amounts.push(amount);
          } else {
            console.warn(`[Recognize] Область ${i + 1}: сумма не распознана`);
          }
        } catch (error) {
          console.error(`[Recognize] Ошибка при обработке области ${i + 1}:`, error);
        }
      }

      if (amounts.length > 0) {
        // Если выбрано несколько областей, суммируем их
        const totalAmount = amounts.reduce((sum, amt) => sum + amt, 0);
        setAmountType('USD');
        setAmountUSD(totalAmount.toFixed(2));
        toast.success(
          amounts.length > 1
            ? `Распознано ${amounts.length} сумм. Итого: ${totalAmount.toFixed(2)}. Проверьте валюту!`
            : `Сумма распознана: ${totalAmount.toFixed(2)}. Проверьте валюту!`
        );
        setShowAreaSelector(false);
      } else {
        toast.error('Не удалось распознать суммы из выбранных областей');
      }
    } catch (error: any) {
      console.error('Ошибка при распознавании из областей:', error);
      toast.error('Ошибка при распознавании сумм');
    } finally {
      setRecognizing(false);
    }
  };

  const handleRotateLeft = () => {
    setPhotoRotation(prev => {
      const newRotation = (prev - 90) % 360;
      // Сбрасываем выбранные области при повороте, так как координаты изменятся
      setSelectedAreas([]);
      return newRotation;
    });
  };

  const handleRotateRight = () => {
    setPhotoRotation(prev => {
      const newRotation = (prev + 90) % 360;
      // Сбрасываем выбранные области при повороте, так как координаты изменятся
      setSelectedAreas([]);
      return newRotation;
    });
  };

  // Функция для применения поворота к изображению и создания нового файла
  const applyRotationToFile = async (file: File, rotation: number): Promise<File> => {
    if (rotation === 0) return file;

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Не удалось создать canvas context'));
          return;
        }

        // Меняем размеры canvas в зависимости от угла поворота
        if (rotation === 90 || rotation === -90 || rotation === 270 || rotation === -270) {
          canvas.width = img.height;
          canvas.height = img.width;
        } else {
          canvas.width = img.width;
          canvas.height = img.height;
        }

        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);

        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Не удалось создать blob'));
            return;
          }
          const rotatedFile = new File([blob], file.name, { type: file.type });
          resolve(rotatedFile);
        }, file.type, 0.95);
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
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
      // Применяем поворот к фото перед отправкой
      const rotatedPhoto = await applyRotationToFile(photo, photoRotation);
      
      const formData = new FormData();
      formData.append('photo', rotatedPhoto);
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
      setPhotoRotation(0);
      setSelectedAreas([]);
      setShowAreaSelector(false);
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
          <Typography variant="subtitle2" gutterBottom sx={{ mb: 1.5, fontWeight: 600 }}>
            Фото накладной *
          </Typography>
          <Box
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            sx={{
              border: '2px dashed',
              borderColor: photoPreview ? 'divider' : 'primary.main',
              borderRadius: 3,
              p: photoPreview ? 2 : 4,
              textAlign: 'center',
              cursor: photoPreview && showAreaSelector ? 'default' : 'pointer',
              bgcolor: photoPreview ? 'background.paper' : 'action.hover',
              position: 'relative',
              transition: 'all 0.3s ease',
              '&:hover': {
                borderColor: 'primary.dark',
                bgcolor: photoPreview ? 'background.paper' : 'action.selected',
                transform: photoPreview && showAreaSelector ? 'none' : 'translateY(-2px)',
                boxShadow: photoPreview && showAreaSelector ? 0 : 2
              }
            }}
          >
            <input
              id="photo-input"
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              style={{ display: 'none' }}
            />
            {!photoPreview ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <CloudUploadIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Загрузите фото накладной
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Перетащите файл сюда или нажмите кнопку ниже
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<CloudUploadIcon />}
                  onClick={() => document.getElementById('photo-input')?.click()}
                  size="large"
                >
                  Выбрать фото
                </Button>
              </Box>
            ) : photoPreview && !showAreaSelector ? (
              <Box sx={{ position: 'relative' }}>
                <Box
                  sx={{
                    position: 'relative',
                    display: 'inline-block',
                    maxWidth: '100%'
                  }}
                >
                  <Box
                    component="img"
                    src={photoPreview}
                    alt="Preview"
                    sx={{
                      maxWidth: '100%',
                      maxHeight: '400px',
                      borderRadius: 2,
                      boxShadow: 3,
                      display: 'block',
                      margin: '0 auto',
                      transform: `rotate(${photoRotation}deg)`,
                      transition: 'transform 0.3s ease-in-out'
                    }}
                  />
                  {photoRotation !== 0 && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        bgcolor: 'rgba(0, 0, 0, 0.6)',
                        borderRadius: 1,
                        p: 0.5,
                        display: 'flex',
                        gap: 0.5
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Tooltip title="Повернуть против часовой стрелки">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRotateLeft();
                          }}
                          sx={{ color: 'white' }}
                        >
                          <RotateLeftIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Повернуть по часовой стрелке">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRotateRight();
                          }}
                          sx={{ color: 'white' }}
                        >
                          <RotateRightIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  )}
                </Box>
                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', mt: 2, flexWrap: 'wrap' }}>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<CropFreeIcon />}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowAreaSelector(true);
                    }}
                    color="primary"
                  >
                    Выбрать области с суммой
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={recognizing ? <CircularProgress size={16} color="inherit" /> : <AutoAwesomeIcon />}
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (photo) {
                        const recognizedAmount = await recognizeAmount(photo);
                        if (recognizedAmount) {
                          setAmountType('USD');
                          setAmountUSD(recognizedAmount.toFixed(2));
                          toast.success(`Сумма распознана: ${recognizedAmount.toFixed(2)}. Проверьте валюту!`);
                        } else {
                          toast.error('Не удалось распознать сумму. Попробуйте выбрать области вручную.');
                        }
                      }
                    }}
                    disabled={recognizing || !photo}
                    color="primary"
                  >
                    {recognizing ? 'Распознавание...' : 'Распознать всю накладную'}
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<RotateLeftIcon />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRotateLeft();
                    }}
                  >
                    Повернуть влево
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<RotateRightIcon />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRotateRight();
                    }}
                  >
                    Повернуть вправо
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      document.getElementById('photo-input')?.click();
                    }}
                  >
                    Заменить фото
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPhoto(null);
                      setPhotoPreview(null);
                      setPhotoRotation(0);
                      setAmountUSD('');
                      setAmountRUB('');
                    }}
                  >
                    Удалить
                  </Button>
                </Box>
              </Box>
            ) : showAreaSelector && photoPreview ? (
              <Box>
                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', mb: 2, flexWrap: 'wrap' }}>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<RotateLeftIcon />}
                    onClick={handleRotateLeft}
                  >
                    Повернуть влево
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<RotateRightIcon />}
                    onClick={handleRotateRight}
                  >
                    Повернуть вправо
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => {
                      document.getElementById('photo-input')?.click();
                    }}
                  >
                    Заменить фото
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    onClick={() => {
                      setPhoto(null);
                      setPhotoPreview(null);
                      setPhotoRotation(0);
                      setSelectedAreas([]);
                      setShowAreaSelector(false);
                    }}
                  >
                    Удалить
                  </Button>
                </Box>
                <AreaSelector
                  imageUrl={photoPreview}
                  onAreasChange={setSelectedAreas}
                  maxAreas={2}
                  rotation={photoRotation}
                />
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mt: 3, flexWrap: 'wrap' }}>
                  <Button
                    variant="contained"
                    color="primary"
                    size="large"
                    startIcon={recognizing ? <CircularProgress size={20} color="inherit" /> : <AutoAwesomeIcon />}
                    onClick={recognizeAmountsFromAreas}
                    disabled={recognizing || selectedAreas.length === 0}
                    sx={{ minWidth: 200 }}
                  >
                    {recognizing ? 'Распознавание...' : 'Распознать суммы'}
                  </Button>
                  <Button
                    variant="outlined"
                    size="large"
                    onClick={() => {
                      setShowAreaSelector(false);
                      setSelectedAreas([]);
                    }}
                    sx={{ minWidth: 120 }}
                  >
                    Отмена
                  </Button>
                </Box>
              </Box>
            ) : (
              <Box>
                <CloudUploadIcon 
                  sx={{ 
                    fontSize: 64, 
                    color: 'primary.main', 
                    mb: 2,
                    opacity: 0.7
                  }} 
                />
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                  Загрузить фото накладной
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Перетащите фото сюда или нажмите для выбора
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                  Поддерживаются форматы: JPG, PNG, WEBP
                </Typography>
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

