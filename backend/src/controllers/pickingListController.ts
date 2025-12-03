import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import PickingList from '../models/PickingList';
import PickingListItem from '../models/PickingListItem';
import Supplier from '../models/Supplier';
import User from '../models/User';
import telegramService from '../services/telegramService';
import googleSheetsService from '../services/googleSheetsService';
import * as XLSX from 'xlsx';
import mongoose from 'mongoose';

export const getPickingLists = async (req: AuthRequest, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    
    const filter: any = {};
    
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) {
        filter.date.$gte = new Date(startDate as string);
      }
      if (endDate) {
        filter.date.$lte = new Date(endDate as string);
      }
    }

    const pickingLists = await PickingList.find(filter)
      .sort({ date: -1 })
      .limit(100);

    res.json(pickingLists);
  } catch (error) {
    console.error('Get picking lists error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

export const getPickingListById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    const pickingList = await PickingList.findById(id);
    if (!pickingList) {
      return res.status(404).json({ message: 'Лист сборки не найден' });
    }

    const items = await PickingListItem.find({ pickingList: id })
      .populate('supplier', 'name')
      .sort({ createdAt: 1 });

    res.json({
      pickingList,
      items
    });
  } catch (error) {
    console.error('Get picking list error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

export const createPickingList = async (req: AuthRequest, res: Response) => {
  try {
    const { date, name, createGoogleSheet } = req.body;

    const pickingList = new PickingList({
      date: date ? new Date(date) : new Date(),
      name: name || undefined
    });

    // Если нужно создать Google таблицу
    if (createGoogleSheet && name) {
      try {
        googleSheetsService.initialize();
        const { spreadsheetId, spreadsheetUrl } = await googleSheetsService.createPickingListSheet(
          name,
          [] // Пустой список, так как товары еще не добавлены
        );

        pickingList.googleSheetId = spreadsheetId;
        pickingList.googleSheetUrl = spreadsheetUrl;
      } catch (googleError: any) {
        console.error('Ошибка создания Google таблицы:', googleError);
        // Продолжаем создание листа даже если Google таблица не создалась
        // Можно вернуть предупреждение, но не ошибку
      }
    }

    await pickingList.save();

    res.status(201).json(pickingList);
  } catch (error) {
    console.error('Create picking list error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

export const createPickingListItem = async (req: AuthRequest, res: Response) => {
  try {
    const { pickingListId, name, article, quantity, price, supplierId } = req.body;

    if (!pickingListId) {
      return res.status(400).json({ message: 'ID листа сборки обязателен' });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Наименование товара обязательно' });
    }

    const pickingList = await PickingList.findById(pickingListId);
    if (!pickingList) {
      return res.status(404).json({ message: 'Лист сборки не найден' });
    }

    const item = new PickingListItem({
      pickingList: pickingListId,
      name: name.trim(),
      article: article ? article.trim() : undefined,
      quantity: quantity ? parseFloat(quantity) : 1,
      price: price ? parseFloat(price) : 0,
      supplier: supplierId || undefined,
      collected: false,
      paid: false,
    });

    await item.save();

    const populatedItem = await PickingListItem.findById(item._id).populate('supplier', 'name');

    res.status(201).json(populatedItem);
  } catch (error) {
    console.error('Create picking list item error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

export const importExcel = async (req: AuthRequest, res: Response) => {
  try {
    const { pickingListId } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: 'Файл Excel обязателен' });
    }

    const pickingList = await PickingList.findById(pickingListId);
    if (!pickingList) {
      return res.status(404).json({ message: 'Лист сборки не найден' });
    }

    // Читаем Excel файл
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

    // Автоматическое определение колонок
    // Название всегда в столбце A (индекс 0)
    let nameCol = 0; // A - всегда название
    let articleCol = -1;
    let quantityCol = -1;
    let priceCol = -1;
    let supplierCol = -1;

    // Анализируем первые несколько строк для определения колонок
    const sampleRows = data.slice(0, Math.min(10, data.length));
    
    // Ищем заголовки в первой строке
    if (data.length > 0) {
      const headerRow = data[0] as any[];
      for (let col = 0; col < headerRow.length; col++) {
        const header = String(headerRow[col] || '').toLowerCase().trim();
        if (header.includes('артикул') || header.includes('article') || header.includes('арт')) {
          articleCol = col;
        } else if (header.includes('количество') || header.includes('кол-во') || header.includes('quantity') || header.includes('qty')) {
          quantityCol = col;
        } else if (header.includes('цена') || header.includes('price') || header.includes('стоимость')) {
          priceCol = col;
        } else if (header.includes('поставщик') || header.includes('supplier') || header.includes('vendor')) {
          supplierCol = col;
        }
      }
    }

    // Если заголовки не найдены, определяем по содержимому
    if (quantityCol === -1 || priceCol === -1 || articleCol === -1) {
      const columnAnalysis: Array<{
        col: number;
        articleScore: number;
        quantityScore: number;
        priceScore: number;
      }> = [];

      const firstRow = data[0] as any[];
      const maxCol = firstRow && Array.isArray(firstRow) ? Math.min(10, firstRow.length) : 10;

      for (let col = 1; col < maxCol; col++) {
        let numericCount = 0;
        let integerCount = 0;
        let decimalCount = 0;
        let stringCount = 0;
        let maxValue = 0;
        let minValue = Infinity;
        let hasLetters = false;
        let totalCells = 0;

        for (const row of sampleRows.slice(1)) {
          const rowArray = row as any[];
          const cell = String(rowArray[col] || '').trim();
          if (!cell) continue;
          
          totalCells++;
          const num = parseFloat(cell);
          
          if (!isNaN(num) && num > 0) {
            numericCount++;
            maxValue = Math.max(maxValue, num);
            minValue = Math.min(minValue, num);
            
            if (Number.isInteger(num)) {
              integerCount++;
            } else {
              decimalCount++;
            }
          } else {
            stringCount++;
            if (/[а-яА-Яa-zA-Z]/.test(cell)) {
              hasLetters = true;
            }
          }
        }

        if (totalCells === 0) continue;

        const articleScore = (stringCount / totalCells) * 0.5 + (hasLetters ? 0.3 : 0) + 
                            (numericCount > 0 && maxValue < 1000 && integerCount / numericCount > 0.8 ? 0.2 : 0);
        
        const quantityScore = (integerCount / totalCells) * 0.6 + 
                             (numericCount > 0 && maxValue < 10000 && maxValue > 0 && maxValue < 1000 ? 0.4 : 0) +
                             (decimalCount === 0 ? 0.2 : -0.2);
        
        const priceScore = (decimalCount / totalCells) * 0.4 + 
                          (numericCount > 0 && maxValue >= 10 ? 0.4 : 0) +
                          (numericCount > 0 && maxValue > 100 ? 0.2 : 0);

        columnAnalysis.push({
          col,
          articleScore,
          quantityScore,
          priceScore
        });
      }

      const sortedByArticle = [...columnAnalysis].sort((a, b) => b.articleScore - a.articleScore);
      const sortedByQuantity = [...columnAnalysis].sort((a, b) => b.quantityScore - a.quantityScore);
      const sortedByPrice = [...columnAnalysis].sort((a, b) => b.priceScore - a.priceScore);

      if (articleCol === -1 && sortedByArticle[0] && sortedByArticle[0].articleScore > 0.3) {
        articleCol = sortedByArticle[0].col;
      }
      
      if (quantityCol === -1 && sortedByQuantity[0] && sortedByQuantity[0].quantityScore > 0.4) {
        if (sortedByQuantity[0].col !== articleCol) {
          quantityCol = sortedByQuantity[0].col;
        } else if (sortedByQuantity[1] && sortedByQuantity[1].quantityScore > 0.4) {
          quantityCol = sortedByQuantity[1].col;
        }
      }
      
      if (priceCol === -1 && sortedByPrice[0] && sortedByPrice[0].priceScore > 0.4) {
        if (sortedByPrice[0].col !== quantityCol && sortedByPrice[0].col !== articleCol) {
          priceCol = sortedByPrice[0].col;
        } else if (sortedByPrice[1] && sortedByPrice[1].priceScore > 0.4) {
          priceCol = sortedByPrice[1].col;
        }
      }

      if (quantityCol === -1) quantityCol = 1; // B по умолчанию
      if (priceCol === -1) priceCol = 2; // C по умолчанию
    }

    console.log(`[Import] Определены колонки: название=${nameCol}, артикул=${articleCol}, количество=${quantityCol}, цена=${priceCol}, поставщик=${supplierCol}`);

    // Получаем существующие товары для обновления
    const existingItems = await PickingListItem.find({ pickingList: pickingList._id });
    const existingItemsMap = new Map<string, typeof existingItems[0]>();
    existingItems.forEach(item => {
      const normalizedName = item.name.toLowerCase().trim();
      existingItemsMap.set(normalizedName, item);
    });

    // Словарь для группировки по названию (ключ: нормализованное название, значение: {originalName, article, quantity, price, supplierName})
    const itemsMap = new Map<string, { 
      originalName: string;
      article?: string;
      quantity: number; 
      price: number;
      supplierName?: string;
    }>();
    
    let currentSupplier: string | null = null;
    
    // Пропускаем заголовки (первую строку) и обрабатываем данные
    for (let i = 1; i < data.length; i++) {
      const row = data[i] as any[];
      if (!row || row.length === 0) continue;

      const name = String(row[nameCol] || '').trim();
      const article = articleCol >= 0 ? String(row[articleCol] || '').trim() : '';
      const quantity = quantityCol >= 0 ? (parseFloat(String(row[quantityCol] || '0')) || 0) : 0;
      const price = priceCol >= 0 ? (parseFloat(String(row[priceCol] || '0')) || 0) : 0;
      const supplierName = supplierCol >= 0 ? String(row[supplierCol] || '').trim() : '';

      // Логируем первые несколько товаров для отладки
      if (i <= 3 && article) {
        console.log(`[Import] Товар ${i}: название="${name}", артикул="${article}", кол-во=${quantity}, цена=${price}`);
      }

      if (!name) continue; // Пропускаем пустые строки

      // Определяем, является ли строка поставщиком
      // Поставщик: есть название в A, но нет количества (B) и цены (C), и нет поставщика в D
      const isSupplier = name && (!quantity || quantity === 0) && (!price || price === 0) && !supplierName;
      
      if (isSupplier) {
        // Это строка с поставщиком - сохраняем для следующих товаров
        currentSupplier = name;
        continue;
      }

      // Это товар - проверяем наличие количества
      if (!quantity || quantity <= 0) {
        continue; // Пропускаем товары без количества
      }

      // Определяем поставщика: приоритет у колонки D, затем у currentSupplier
      const finalSupplierName = supplierName || currentSupplier || undefined;

      const normalizedName = name.toLowerCase().trim();
      const existingItem = itemsMap.get(normalizedName);
      
      if (existingItem) {
        // Если товар с таким названием уже есть в файле, обновляем количество (не суммируем)
        existingItem.quantity = quantity;
        // Обновляем цену, если она больше 0
        if (price > 0) {
          existingItem.price = price;
        }
        // Обновляем артикул, если он указан
        if (article) {
          existingItem.article = article;
        }
        // Обновляем поставщика, если он указан
        if (finalSupplierName) {
          existingItem.supplierName = finalSupplierName;
        }
      } else {
        // Создаем новый элемент
        itemsMap.set(normalizedName, {
          originalName: name,
          article: article || undefined,
          quantity,
          price: price || 0,
          supplierName: finalSupplierName,
        });
      }
    }

    if (itemsMap.size === 0) {
      return res.status(400).json({ message: 'Не найдено данных для импорта' });
    }

    // Получаем всех поставщиков для поиска по имени
    const allSuppliers = await Supplier.find({});
    const suppliersMap = new Map<string, typeof allSuppliers[0]>();
    allSuppliers.forEach(supplier => {
      suppliersMap.set(supplier.name.toLowerCase().trim(), supplier);
    });

    let updatedCount = 0;
    let createdCount = 0;
    let suppliersCreatedCount = 0;

    // Обрабатываем товары: обновляем существующие или создаем новые
    for (const [normalizedName, itemData] of itemsMap.entries()) {
      const existingItem = existingItemsMap.get(normalizedName);
      
      // Находим или создаем поставщика по имени
      let supplierId: mongoose.Types.ObjectId | undefined = undefined;
      if (itemData.supplierName) {
        const supplierNameLower = itemData.supplierName.toLowerCase().trim();
        let supplier = suppliersMap.get(supplierNameLower);
        
        if (!supplier) {
          // Поставщик не найден - создаем нового
          try {
            const newSupplier = new Supplier({
              name: itemData.supplierName.trim(),
              balance: 0,
            });
            await newSupplier.save();
            suppliersMap.set(supplierNameLower, newSupplier);
            supplier = newSupplier;
            suppliersCreatedCount++;
            console.log(`[Import] Создан новый поставщик: ${itemData.supplierName}`);
          } catch (error: any) {
            console.error(`[Import] Ошибка создания поставщика "${itemData.supplierName}":`, error.message);
            // Продолжаем без поставщика, если не удалось создать
          }
        }
        
        if (supplier) {
          supplierId = supplier._id;
        }
      }

      if (existingItem) {
        // Обновляем существующий товар - суммируем количество при повторном импорте
        existingItem.quantity += itemData.quantity;
        // Обновляем цену, если она больше 0
        if (itemData.price > 0) {
          existingItem.price = itemData.price;
        }
        // Обновляем артикул, если он указан
        if (itemData.article) {
          existingItem.article = itemData.article;
        }
        // Обновляем поставщика, если он указан
        if (supplierId) {
          existingItem.supplier = supplierId;
        }
        await existingItem.save();
        updatedCount++;
      } else {
        // Создаем новый товар
        const newItem = new PickingListItem({
          pickingList: pickingList._id,
          name: itemData.originalName,
          article: itemData.article,
          quantity: itemData.quantity,
          price: itemData.price,
          supplier: supplierId,
          collected: false,
          paid: false,
        });
        await newItem.save();
        createdCount++;
      }
    }

    const populatedItems = await PickingListItem.find({ pickingList: pickingList._id })
      .populate('supplier', 'name')
      .sort({ createdAt: 1 });

    res.json({
      message: `Импортировано: создано ${createdCount}, обновлено ${updatedCount} элементов${suppliersCreatedCount > 0 ? `, создано поставщиков: ${suppliersCreatedCount}` : ''}`,
      items: populatedItems,
      stats: {
        created: createdCount,
        updated: updatedCount,
        suppliersCreated: suppliersCreatedCount,
        total: populatedItems.length
      }
    });
  } catch (error) {
    console.error('Import Excel error:', error);
    res.status(500).json({ message: 'Ошибка при импорте Excel файла' });
  }
};

export const updatePickingListItem = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { collected, paid, price, supplierId, quantity, name, article } = req.body;

    const item = await PickingListItem.findById(id);
    if (!item) {
      return res.status(404).json({ message: 'Элемент не найден' });
    }

    const wasCollected = item.collected;
    if (collected !== undefined) {
      item.collected = collected;
    }
    if (paid !== undefined) {
      item.paid = paid;
    }
    if (price !== undefined) {
      item.price = price;
    }
    if (quantity !== undefined) {
      item.quantity = quantity;
    }
    if (name !== undefined) {
      item.name = name;
    }
    if (article !== undefined) {
      item.article = article;
    }
    if (supplierId !== undefined) {
      if (supplierId) {
        const supplier = await Supplier.findById(supplierId);
        if (!supplier) {
          return res.status(404).json({ message: 'Поставщик не найден' });
        }
        item.supplier = supplier._id;
      } else {
        item.supplier = undefined;
      }
    }

    await item.save();
    await item.populate('supplier', 'name');

    // Отправляем уведомление в Telegram при изменении статуса collected
    if (collected !== undefined && collected !== wasCollected) {
      try {
        const user = await User.findById(req.userId);
        if (user) {
          await telegramService.notifyPickingListItemCollected(
            user.login,
            item.name,
            collected ? 'collected' : 'not_collected'
          );
        }
      } catch (telegramError) {
        // Не прерываем выполнение, если Telegram уведомление не отправилось
        console.error('Telegram notification error:', telegramError);
      }
    }

    res.json(item);
  } catch (error) {
    console.error('Update picking list item error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

export const deletePickingListItem = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await PickingListItem.findByIdAndDelete(id);

    res.json({ message: 'Элемент удалён' });
  } catch (error) {
    console.error('Delete picking list item error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

export const deletePickingList = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await PickingListItem.deleteMany({ pickingList: id });
    await PickingList.findByIdAndDelete(id);

    res.json({ message: 'Лист сборки удалён' });
  } catch (error) {
    console.error('Delete picking list error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};
