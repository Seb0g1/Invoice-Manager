import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import PickingList from '../models/PickingList';
import PickingListItem from '../models/PickingListItem';
import Supplier from '../models/Supplier';
import User from '../models/User';
import telegramService from '../services/telegramService';
import googleSheetsService from '../services/googleSheetsService';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import mongoose from 'mongoose';
import { format } from 'date-fns';

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
    const { pickingListId, mode } = req.body;
    const importMode = mode || 'add'; // 'add', 'replace', 'remove', 'delete'

    console.log(`[Import] Начало импорта. pickingListId: ${pickingListId}, mode: ${importMode}`);
    console.log(`[Import] Файл получен: ${req.file ? 'да' : 'нет'}`);

    if (!req.file) {
      return res.status(400).json({ message: 'Файл Excel обязателен' });
    }

    if (!pickingListId) {
      return res.status(400).json({ message: 'ID листа сборки обязателен' });
    }

    const pickingList = await PickingList.findById(pickingListId);
    if (!pickingList) {
      return res.status(404).json({ message: 'Лист сборки не найден' });
    }
    
    console.log(`[Import] Лист сборки найден: ${pickingList.name}`);

    // Читаем Excel файл
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    console.log(`[Import] Excel файл прочитан. Листов: ${workbook.SheetNames.length}, строк данных: ${data.length}`);
    if (data.length > 0 && data.length <= 5) {
      console.log(`[Import] Первые строки данных:`, data.slice(0, 3));
    }
    
    // Функция для правильного парсинга числа из Excel
    const parseNumber = (value: any, rowIndex?: number, columnName?: string): number | null => {
      if (value === null || value === undefined || value === '') {
        return null;
      }
      
      if (typeof value === 'number') {
        if (isNaN(value)) {
          return null;
        }
        return value;
      }
      
      if (value === null || value === undefined) {
        return null;
      }
      let str = String(value).trim();
      
      if (str === '') {
        return null;
      }
      
      str = str.replace(/\s/g, '');
      str = str.replace(',', '.');
      str = str.replace(/[^\d.-]/g, '');
      
      if (str === '' || str === '-' || str === '.') {
        return null;
      }
      
      const num = parseFloat(str);
      return isNaN(num) ? null : num;
    };

    // Автоматическое определение колонок
    let nameCol = -1; // -1 означает "не определено"
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
        if (header.includes('наименование') || header.includes('название') || header.includes('name') || header.includes('товар') || header.includes('product')) {
          nameCol = col;
        } else if (header.includes('артикул') || header.includes('article') || header.includes('арт')) {
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
    if (quantityCol === -1 || priceCol === -1 || articleCol === -1 || nameCol === -1) {
      const columnAnalysis: Array<{
        col: number;
        nameScore: number;
        articleScore: number;
        quantityScore: number;
        priceScore: number;
      }> = [];

      const firstRow = data[0] as any[];
      const maxCol = firstRow && Array.isArray(firstRow) ? Math.min(10, firstRow.length) : 10;

      // Начинаем с колонки 0, чтобы найти название
      for (let col = 0; col < maxCol; col++) {
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

        // Оценка для колонки названия: много текста с буквами, обычно длинные строки
        const nameScore = (stringCount / totalCells) * 0.7 + (hasLetters ? 0.3 : 0) + 
                         (numericCount / totalCells < 0.2 ? 0.2 : -0.2); // Название обычно не числовое
        
        // Оценка для артикула: строки (могут быть буквы+цифры), обычно короче названия
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
          nameScore,
          articleScore,
          quantityScore,
          priceScore
        });
      }

      const sortedByName = [...columnAnalysis].sort((a, b) => b.nameScore - a.nameScore);
      const sortedByArticle = [...columnAnalysis].sort((a, b) => b.articleScore - a.articleScore);
      const sortedByQuantity = [...columnAnalysis].sort((a, b) => b.quantityScore - a.quantityScore);
      const sortedByPrice = [...columnAnalysis].sort((a, b) => b.priceScore - a.priceScore);

      // Определяем колонку названия (если не найдена по заголовку)
      if (nameCol === -1 && sortedByName[0] && sortedByName[0].nameScore > 0.5) {
        // Проверяем, не является ли эта колонка артикулом
        const potentialNameCol = sortedByName[0].col;
        const potentialArticleCol = sortedByArticle[0]?.col;
        if (potentialNameCol !== potentialArticleCol) {
          nameCol = potentialNameCol;
        } else if (sortedByName[1] && sortedByName[1].nameScore > 0.5) {
          nameCol = sortedByName[1].col;
        }
      }

      if (articleCol === -1 && sortedByArticle[0] && sortedByArticle[0].articleScore > 0.3) {
        // Убеждаемся, что артикул не совпадает с названием
        if (sortedByArticle[0].col !== nameCol) {
          articleCol = sortedByArticle[0].col;
        } else if (sortedByArticle[1] && sortedByArticle[1].articleScore > 0.3) {
          articleCol = sortedByArticle[1].col;
        }
      }
      
      if (quantityCol === -1 && sortedByQuantity[0] && sortedByQuantity[0].quantityScore > 0.4) {
        if (sortedByQuantity[0].col !== articleCol && sortedByQuantity[0].col !== nameCol) {
          quantityCol = sortedByQuantity[0].col;
        } else if (sortedByQuantity[1] && sortedByQuantity[1].quantityScore > 0.4) {
          quantityCol = sortedByQuantity[1].col;
        }
      }
      
      if (priceCol === -1 && sortedByPrice[0] && sortedByPrice[0].priceScore > 0.4) {
        if (sortedByPrice[0].col !== quantityCol && sortedByPrice[0].col !== articleCol && sortedByPrice[0].col !== nameCol) {
          priceCol = sortedByPrice[0].col;
        } else if (sortedByPrice[1] && sortedByPrice[1].priceScore > 0.4) {
          priceCol = sortedByPrice[1].col;
        }
      }

      // Значения по умолчанию (только если не удалось определить автоматически)
      if (nameCol === -1) nameCol = 0; // A по умолчанию
      if (articleCol === -1) articleCol = 0; // Если не найден, используем A (может быть артикул или название)
      if (quantityCol === -1) quantityCol = 1; // B по умолчанию
      if (priceCol === -1) priceCol = 3; // D по умолчанию (C может быть названием)
    }

    console.log(`[Import] Определены колонки: название=${nameCol}, артикул=${articleCol}, количество=${quantityCol}, цена=${priceCol}, поставщик=${supplierCol}`);

    // Получаем существующие товары для обновления
    const existingItems = await PickingListItem.find({ pickingList: pickingList._id });
    const existingItemsMap = new Map<string, typeof existingItems[0]>();
    existingItems.forEach(item => {
      // Используем артикул как ключ, если он есть, иначе название
      const key = item.article && item.article.length > 0
        ? `article:${item.article.toLowerCase().trim()}`
        : `name:${item.name.toLowerCase().trim()}`;
      existingItemsMap.set(key, item);
      
      // Также добавляем по названию для обратной совместимости
      const nameKey = `name:${item.name.toLowerCase().trim()}`;
      if (!existingItemsMap.has(nameKey)) {
        existingItemsMap.set(nameKey, item);
      }
    });
    
    console.log(`[Import] Найдено существующих товаров: ${existingItems.length}`);

    // Словарь для группировки по названию (ключ: нормализованное название, значение: {originalName, article, quantity, price, supplierName})
    const itemsMap = new Map<string, { 
      originalName: string;
      article?: string;
      quantity: number; 
      price: number;
      supplierName?: string;
    }>();
    
    let currentSupplier: string | null = null;
    
    // Режим удаления по артикулу
    if (importMode === 'delete') {
      const articlesToDelete: string[] = [];
      for (let i = 0; i < data.length; i++) {
        const row = data[i] as any[];
        if (!row || row.length === 0) continue;
        
        const name = String(row[nameCol] || '').trim();
        const article = articleCol >= 0 ? String(row[articleCol] || '').trim() : '';
        
        // Пропускаем строку заголовка (проверяем и название, и артикул)
        const headerNames = ['наименование', 'название', 'name', 'товар', 'product', 'артикул', 'article'];
        const headerArticles = ['артикул', 'article', 'арт'];
        if (i === 0 && (headerNames.includes(name.toLowerCase()) || headerArticles.includes(article.toLowerCase()))) {
          continue;
        }
        
        // В режиме delete нужен только артикул
        if (!article) continue;
        
        articlesToDelete.push(article);
      }
      
      if (articlesToDelete.length === 0) {
        return res.status(400).json({ message: `Не найдено артикулов для удаления. Убедитесь, что в колонке артикулов (${articleCol >= 0 ? String.fromCharCode(65 + articleCol) : 'C'}) указаны артикулы.` });
      }
      
      const result = await PickingListItem.deleteMany({ 
        pickingList: pickingList._id,
        article: { $in: articlesToDelete } 
      });
      
      const populatedItems = await PickingListItem.find({ pickingList: pickingList._id })
        .populate('supplier', 'name')
        .sort({ createdAt: 1 });
      
      return res.json({
        message: `Удалено товаров по артикулам: ${result.deletedCount} из ${articlesToDelete.length}`,
        items: populatedItems,
        stats: {
          deleted: result.deletedCount,
          requested: articlesToDelete.length
        }
      });
    }
    
    // Пропускаем заголовки и обрабатываем данные для других режимов
    for (let i = 0; i < data.length; i++) {
      const row = data[i] as any[];
      if (!row || row.length === 0) continue;

      const name = String(row[nameCol] || '').trim();
      const article = articleCol >= 0 ? String(row[articleCol] || '').trim() : '';
      const quantityRaw = row[quantityCol];
      const priceRaw = row[priceCol];
      const supplierName = supplierCol >= 0 ? String(row[supplierCol] || '').trim() : '';

      // Пропускаем строки без названия (кроме режима delete, где нужен только артикул)
      if (importMode !== 'delete' && (!name || name.length === 0)) {
        continue;
      }
      
      // Пропускаем строку заголовка (проверяем название, артикул и другие заголовки)
      const headerNames = ['наименование', 'название', 'name', 'товар', 'product', 'артикул', 'article', 'количество', 'кол-во', 'quantity', 'цена', 'price'];
      const nameLower = name.toLowerCase();
      const articleLower = article.toLowerCase();
      if (i === 0 && (headerNames.includes(nameLower) || headerNames.includes(articleLower))) {
        continue;
      }
      
      // Парсим количество и цену
      const quantity = parseNumber(quantityRaw, i, 'количество');
      const price = parseNumber(priceRaw, i, 'цена') || 0;

      // Определяем, является ли строка поставщиком
      const isSupplier = name && (quantity === null || quantity === 0) && (price === 0 || price === null) && !supplierName;
      
      if (isSupplier) {
        currentSupplier = name;
        continue;
      }

      // Для режима remove можно пропускать строки без количества, для остальных - проверяем
      if (quantity === null && importMode !== 'replace') {
        continue;
      }

      // Определяем поставщика
      const finalSupplierName = supplierName || currentSupplier || undefined;

      // Используем артикул как ключ, если он есть, иначе название
      const key = article && article.length > 0 
        ? `article:${article.toLowerCase()}` 
        : `name:${name.toLowerCase()}`;
      
      const existingItem = itemsMap.get(key);
      const quantityValue = quantity === null ? 0 : quantity;
      
      if (existingItem) {
        if (importMode === 'add') {
          existingItem.quantity += quantityValue;
        } else if (importMode === 'replace') {
          existingItem.quantity = Math.max(0, quantityValue);
        } else if (importMode === 'remove') {
          // В режиме remove накапливаем сумму для вычета
          existingItem.quantity += Math.abs(quantityValue);
        }
        if (price > 0) {
          existingItem.price = price;
        }
        if (article && article.length > 0) {
          existingItem.article = article;
        }
        if (finalSupplierName) {
          existingItem.supplierName = finalSupplierName;
        }
      } else {
        // В режиме remove для новых товаров в Excel мы накапливаем количество для вычета
        // (хотя обычно в remove режиме новые товары не должны создаваться в itemsMap)
        itemsMap.set(key, {
          originalName: name,
          article: article && article.length > 0 ? article : undefined,
          quantity: importMode === 'remove' ? Math.abs(quantityValue) : Math.max(0, quantityValue),
          price: Math.max(0, price),
          supplierName: finalSupplierName,
        });
      }
    }

    console.log(`[Import] Размер itemsMap после обработки: ${itemsMap.size}`);
    if (itemsMap.size === 0) {
      console.log(`[Import] ОШИБКА: itemsMap пуст. Всего строк в Excel: ${data.length}`);
      return res.status(400).json({ message: 'Не найдено данных для импорта. Убедитесь, что в файле есть товары с количеством.' });
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
    console.log(`[Import] Всего товаров для обработки: ${itemsMap.size}`);
    for (const [key, itemData] of itemsMap.entries()) {
      const existingItem = existingItemsMap.get(key);
      
      if (itemsMap.size <= 5) {
        console.log(`[Import] Обработка товара: "${itemData.originalName}", ключ: ${key}, найден в БД: ${existingItem ? 'да' : 'нет'}`);
      }
      
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
        const oldQuantity = existingItem.quantity || 0;
        
        // Обновляем существующий товар в зависимости от режима
        if (importMode === 'add') {
          existingItem.quantity = oldQuantity + itemData.quantity;
          updatedCount++;
        } else if (importMode === 'replace') {
          existingItem.quantity = Math.max(0, itemData.quantity);
          updatedCount++;
        } else if (importMode === 'remove') {
          const removeAmount = Math.abs(itemData.quantity);
          existingItem.quantity = Math.max(0, oldQuantity - removeAmount);
          if (existingItem.quantity === 0) {
            // Если количество стало 0, удаляем товар
            await PickingListItem.findByIdAndDelete(existingItem._id);
            updatedCount++;
            continue;
          } else {
            updatedCount++;
          }
        }
        
        // Обновляем цену, если она больше 0
        if (itemData.price > 0) {
          existingItem.price = itemData.price;
        }
        // Обновляем артикул, если он не был задан ранее
        if (!existingItem.article && itemData.article) {
          existingItem.article = itemData.article;
        }
        // Обновляем поставщика, если он указан
        if (supplierId) {
          existingItem.supplier = supplierId;
        }
        
        if (importMode !== 'remove' || existingItem.quantity > 0) {
          await existingItem.save();
        }
      } else {
        // Создаем новый товар только если режим не 'remove'
        if (importMode !== 'remove') {
          const newItem = new PickingListItem({
            pickingList: pickingList._id,
            name: itemData.originalName,
            article: itemData.article,
            quantity: Math.max(0, itemData.quantity),
            price: Math.max(0, itemData.price),
            supplier: supplierId,
            collected: false,
            paid: false,
          });
          await newItem.save();
          createdCount++;
        }
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
  } catch (error: any) {
    console.error('Import Excel error:', error);
    console.error('Import Excel error stack:', error.stack);
    const errorMessage = error.message || 'Ошибка при импорте Excel файла';
    res.status(500).json({ message: errorMessage });
  }
};

export const exportPickingList = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ message: 'ID листа сборки обязателен' });
    }

    const pickingList = await PickingList.findById(id);
    if (!pickingList) {
      return res.status(404).json({ message: 'Лист сборки не найден' });
    }

    // Получаем все товары листа сборки
    const items = await PickingListItem.find({ pickingList: id })
      .populate('supplier', 'name')
      .sort({ createdAt: 1 })
      .lean();

    // Создаем Excel файл с ExcelJS
    const workbook = new ExcelJS.Workbook();
    const sheetName = pickingList.name || `Лист сборки ${format(new Date(pickingList.date), 'dd.MM.yyyy')}`;
    const worksheet = workbook.addWorksheet('Товары');

    // Стили для заголовков
    const headerStyle = {
      font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 },
      fill: {
        type: 'pattern' as const,
        pattern: 'solid' as const,
        fgColor: { argb: 'FF4472C4' } // Синий цвет
      },
      alignment: { horizontal: 'center' as const, vertical: 'middle' as const },
      border: {
        top: { style: 'thin' as const },
        left: { style: 'thin' as const },
        bottom: { style: 'thin' as const },
        right: { style: 'thin' as const }
      }
    };

    // Стили для границ ячеек
    const borderStyle = {
      border: {
        top: { style: 'thin' as const },
        left: { style: 'thin' as const },
        bottom: { style: 'thin' as const },
        right: { style: 'thin' as const }
      }
    };

    // Добавляем заголовки
    worksheet.columns = [
      { header: 'Наименование', key: 'name', width: 40 },
      { header: 'Количество', key: 'quantity', width: 12 },
      { header: 'Артикул', key: 'article', width: 20 },
      { header: 'Цена', key: 'price', width: 12 },
      { header: 'Поставщик', key: 'supplier', width: 25 },
      { header: 'Собрано', key: 'collected', width: 12 },
      { header: 'Оплачено', key: 'paid', width: 12 },
      { header: 'Дата создания', key: 'createdAt', width: 18 }
    ];

    // Применяем стили к заголовкам
    worksheet.getRow(1).eachCell((cell: ExcelJS.Cell) => {
      cell.style = headerStyle;
    });

    // Устанавливаем высоту строки заголовка
    worksheet.getRow(1).height = 25;

    // Добавляем данные
    items.forEach((item: any, index: number) => {
      const supplierName = item.supplier && typeof item.supplier === 'object' 
        ? item.supplier.name 
        : item.supplier || '';
      
      const row = worksheet.addRow({
        name: item.name || '',
        quantity: item.quantity ?? 0,
        article: item.article || '',
        price: item.price ?? 0,
        supplier: supplierName,
        collected: item.collected ? 'Да' : 'Нет',
        paid: item.paid ? 'Да' : 'Нет',
        createdAt: item.createdAt ? new Date(item.createdAt).toLocaleDateString('ru-RU') : ''
      });

      // Применяем стили к ячейкам строки
      row.eachCell((cell: ExcelJS.Cell, colNumber: number) => {
        // Выравнивание: текст - слева, числа - справа, статусы - по центру
        const isTextColumn = colNumber === 1 || colNumber === 3 || colNumber === 5; // name, article, supplier
        const isStatusColumn = colNumber === 6 || colNumber === 7; // collected, paid
        cell.style = {
          ...borderStyle.border,
          alignment: isTextColumn
            ? { horizontal: 'left' as const, vertical: 'middle' as const }
            : isStatusColumn
            ? { horizontal: 'center' as const, vertical: 'middle' as const }
            : { horizontal: 'right' as const, vertical: 'middle' as const }
        };

        // Четные строки с легким фоном
        if ((index + 2) % 2 === 0) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF2F2F2' }
          };
        }
      });

      // Выделяем собранные товары зеленым
      if (item.collected) {
        row.getCell(6).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFC6EFCE' } // Светло-зеленый
        };
        row.getCell(6).font = { bold: true, color: { argb: 'FF006100' } };
      }

      // Выделяем оплаченные товары зеленым
      if (item.paid) {
        row.getCell(7).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFC6EFCE' } // Светло-зеленый
        };
        row.getCell(7).font = { bold: true, color: { argb: 'FF006100' } };
      }
    });

    // Замораживаем строку заголовка
    worksheet.views = [
      { state: 'frozen', ySplit: 1 }
    ];

    // Генерируем буфер
    const buffer = await workbook.xlsx.writeBuffer();

    // Устанавливаем заголовки для скачивания
    const filename = `picking-list-${sheetName}-${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('Export picking list error:', error);
    res.status(500).json({ message: 'Ошибка при экспорте листа сборки' });
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
