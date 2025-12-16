import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import WarehouseItem from '../models/WarehouseItem';
import * as XLSX from 'xlsx';
import mongoose from 'mongoose';

export const getWarehouseItems = async (req: AuthRequest, res: Response) => {
  try {
    const { search, category, page = '1', limit = '50' } = req.query;
    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = Math.min(parseInt(limit as string, 10) || 50, 200); // Максимум 200 на страницу
    const skip = (pageNum - 1) * limitNum;

    const filter: any = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search as string, $options: 'i' } },
        { article: { $regex: search as string, $options: 'i' } }
      ];
    }

    if (category) {
      filter.category = category;
    }

    // Получаем общее количество для пагинации
    const total = await WarehouseItem.countDocuments(filter);

    // Получаем товары с пагинацией
    const items = await WarehouseItem.find(filter)
      .sort({ name: 1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Логируем товар для отладки
    const testItems = items.filter((item: any) => 
      item.name === 'A.Dunhill Icon Racing Men 100 мл парфюмерная вода' || item.article === '35515'
    );
    if (testItems.length > 0) {
      console.log(`[Backend API] Найдено ${testItems.length} товаров с артикулом 35515 или названием "A.Dunhill Icon Racing Men 100 мл парфюмерная вода":`);
      testItems.forEach((item: any, idx: number) => {
        console.log(`[Backend API] Товар ${idx + 1}:`, {
          _id: item._id,
          name: item.name,
          quantity: item.quantity,
          quantityType: typeof item.quantity,
          article: item.article,
        });
      });
      
      // Если найдено несколько товаров, суммируем количество
      if (testItems.length > 1) {
        const totalQuantity = testItems.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
        console.error(`[Backend API] ⚠️ ОШИБКА: Найдено ${testItems.length} дубликатов! Суммарное количество: ${totalQuantity}`);
      }
    }

    res.json({
      items,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Get warehouse items error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

/**
 * Получение всех ID товаров с учетом фильтров (без пагинации)
 */
export const getAllWarehouseItemIds = async (req: AuthRequest, res: Response) => {
  try {
    const { search, category } = req.query;

    const filter: any = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search as string, $options: 'i' } },
        { article: { $regex: search as string, $options: 'i' } }
      ];
    }

    if (category) {
      filter.category = category;
    }

    // Получаем только ID товаров без пагинации
    const items = await WarehouseItem.find(filter)
      .select('_id')
      .lean();

    // Безопасное преобразование ID в строки
    const ids = items.map((item: any) => {
      if (!item || !item._id) {
        console.warn('Item without _id found:', item);
        return null;
      }
      // Если _id уже строка, возвращаем как есть, иначе преобразуем
      return typeof item._id === 'string' ? item._id : String(item._id);
    }).filter((id: string | null): id is string => id !== null);

    console.log(`[getAllWarehouseItemIds] Found ${ids.length} items with filters:`, { search, category });

    res.json({
      ids,
      count: ids.length
    });
  } catch (error: any) {
    console.error('Get all warehouse item IDs error:', error);
    const errorMessage = error?.message || 'Ошибка сервера';
    res.status(500).json({ 
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

export const getWarehouseItemById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const item = await WarehouseItem.findById(id);

    if (!item) {
      return res.status(404).json({ message: 'Товар не найден' });
    }

    res.json(item);
  } catch (error) {
    console.error('Get warehouse item by ID error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

export const createWarehouseItem = async (req: AuthRequest, res: Response) => {
  try {
    const { name, quantity, article, price, category, lowStockThreshold } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Наименование товара обязательно' });
    }

    const item = new WarehouseItem({
      name: name.trim(),
      quantity: quantity ? parseFloat(quantity) : undefined,
      article: article ? article.trim() : undefined,
      price: price ? parseFloat(price) : undefined,
      category: category ? category.trim() : undefined,
      lowStockThreshold: lowStockThreshold ? parseFloat(lowStockThreshold) : undefined,
    });

    await item.save();
    res.status(201).json(item);
  } catch (error: any) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Товар с таким наименованием уже существует' });
    }
    console.error('Create warehouse item error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

export const updateWarehouseItem = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, quantity, article, price, category, lowStockThreshold } = req.body;

    const item = await WarehouseItem.findById(id);
    if (!item) {
      return res.status(404).json({ message: 'Товар не найден' });
    }

    if (name && name.trim()) {
      item.name = name.trim();
    }
    if (quantity !== undefined) {
      item.quantity = parseFloat(quantity);
    }
    if (article !== undefined) {
      item.article = article ? article.trim() : undefined;
    }
    if (price !== undefined) {
      item.price = parseFloat(price);
    }
    if (category !== undefined) {
      item.category = category ? category.trim() : undefined;
    }
    if (lowStockThreshold !== undefined) {
      item.lowStockThreshold = lowStockThreshold ? parseFloat(lowStockThreshold) : undefined;
    }

    await item.save();
    res.json(item);
  } catch (error) {
    console.error('Update warehouse item error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

export const deleteWarehouseItem = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const item = await WarehouseItem.findById(id);
    if (!item) {
      return res.status(404).json({ message: 'Товар не найден' });
    }

    await WarehouseItem.findByIdAndDelete(id);
    res.json({ message: 'Товар успешно удалён' });
  } catch (error) {
    console.error('Delete warehouse item error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

/**
 * Массовое удаление товаров
 */
export const deleteWarehouseItems = async (req: AuthRequest, res: Response) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'Необходимо указать массив ID товаров для удаления' });
    }

    const result = await WarehouseItem.deleteMany({ _id: { $in: ids } });
    
    res.json({ 
      message: `Удалено товаров: ${result.deletedCount}`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Delete warehouse items error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

export const importWarehouseItems = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Excel файл обязателен' });
    }

    const { mode = 'add' } = req.body; // 'add' - добавлять количество, 'replace' - заменять, 'remove' - уменьшать, 'delete' - удалять по артикулу
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    // Словарь для группировки по названию или артикулу
    const itemsMap = new Map<string, { originalName: string; quantity: number; article?: string; price: number }>();
    
    // Функция для правильного парсинга числа из Excel
    const parseNumber = (value: any, rowIndex?: number, columnName?: string): number | null => {
      if (value === null || value === undefined || value === '') {
        return null; // Возвращаем null для пустых значений
      }
      
      // Если уже число, возвращаем его
      if (typeof value === 'number') {
        if (isNaN(value)) {
          return null;
        }
        // Логируем для первых нескольких строк
        if (rowIndex !== undefined && rowIndex < 5 && columnName) {
          console.log(`[Import Excel] Строка ${rowIndex + 1}, ${columnName}: уже число = ${value}`);
        }
        return value;
      }
      
      // Преобразуем в строку и убираем пробелы
      // Проверяем, что value не null/undefined перед вызовом toString
      if (value === null || value === undefined) {
        return null;
      }
      let str = String(value).trim();
      
      // Если строка пустая после trim, возвращаем null
      if (str === '') {
        return null;
      }
      
      // Логируем исходное значение для первых нескольких строк
      if (rowIndex !== undefined && rowIndex < 5 && columnName) {
        console.log(`[Import Excel] Строка ${rowIndex + 1}, ${columnName}: исходное значение = "${str}" (тип: ${typeof value})`);
      }
      
      // Убираем все пробелы (включая неразрывные)
      str = str.replace(/\s/g, '');
      
      // Заменяем запятую на точку (для русской локали)
      str = str.replace(',', '.');
      
      // Убираем все символы кроме цифр, точки и минуса в начале
      str = str.replace(/[^\d.-]/g, '');
      
      // Если после очистки строка пустая, возвращаем null
      if (str === '' || str === '-' || str === '.') {
        if (rowIndex !== undefined && rowIndex < 5 && columnName) {
          console.log(`[Import Excel] Строка ${rowIndex + 1}, ${columnName}: после очистки пусто`);
        }
        return null;
      }
      
      // Парсим число
      const num = parseFloat(str);
      
      // Логируем результат для первых нескольких строк
      if (rowIndex !== undefined && rowIndex < 5 && columnName) {
        console.log(`[Import Excel] Строка ${rowIndex + 1}, ${columnName}: после парсинга = ${num} (из строки "${str}")`);
      }
      
      // Возвращаем null если не число или NaN
      return isNaN(num) ? null : num;
    };

    // Пропускаем заголовок (если есть), начинаем с первой строки данных
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      
      // Пропускаем полностью пустые строки
      if (!row || row.length === 0) {
        continue;
      }
      
      // Получаем значения из колонок
      const name = row[0] ? String(row[0]).trim() : '';
      const quantityRaw = row[1];
      const article = row[2] ? String(row[2]).trim() : '';
      const priceRaw = row[3];
      
      // Пропускаем строки без названия (пустые или только пробелы)
      if (!name || name.length === 0) {
        if (i < 5) {
          console.log(`[Import Excel] Строка ${i + 1}: пропущена (нет названия)`);
        }
        continue;
      }
      
      // Пропускаем строку заголовка (первая строка с типичными названиями заголовков)
      const headerNames = ['наименование', 'название', 'name', 'товар', 'product', 'артикул', 'article', 'количество', 'кол-во', 'quantity', 'цена', 'price'];
      const nameLower = name.toLowerCase();
      if (i === 0 && headerNames.includes(nameLower)) {
        console.log(`[Import Excel] Строка ${i + 1}: пропущена (заголовок: "${name}")`);
        continue;
      }
      
      // Также пропускаем строки, где название совпадает с заголовком (на случай, если заголовок не в первой строке)
      if (headerNames.includes(nameLower) && (quantityRaw === null || quantityRaw === undefined || quantityRaw === '')) {
        console.log(`[Import Excel] Строка ${i + 1}: пропущена (похоже на заголовок: "${name}")`);
        continue;
      }
      
      // Парсим количество и цену
      const quantity = parseNumber(quantityRaw, i, 'количество'); // Может быть null
      const price = parseNumber(priceRaw, i, 'цена'); // Может быть null

      // Для режима удаления нужен только артикул
      if (mode === 'delete') {
        if (article && article.length > 0) {
          const key = `article:${article.toLowerCase()}`;
          if (!itemsMap.has(key)) {
            itemsMap.set(key, {
              originalName: name || '',
              quantity: 0,
              article: article,
              price: 0,
            });
          }
        }
        continue;
      }
      
      // Для остальных режимов: пропускаем строки без количества (кроме режима replace)
      // В режиме replace можно создать товар с количеством 0
      if (quantity === null && mode !== 'replace') {
        if (i < 5) {
          console.log(`[Import Excel] Строка ${i + 1} (${name}): пропущена (нет количества, режим: ${mode})`);
        }
        continue; // Пропускаем строки без количества
      }
      
      // Если количество null, но режим replace - используем 0
      if (quantity === null && mode === 'replace') {
        if (i < 5) {
          console.log(`[Import Excel] Строка ${i + 1} (${name}): количество null, будет установлено 0 (режим replace)`);
        }
      }
      
      // Используем артикул как ключ, если он есть, иначе название
      const key = article && article.length > 0 
        ? `article:${article.toLowerCase()}` 
        : `name:${name.toLowerCase()}`;
      
      const existingItem = itemsMap.get(key);
      
      // Для режима replace используем 0 если quantity === null, для остальных режимов пропускаем строки с null
      // Но мы уже проверили это выше, так что здесь quantity не должен быть null (кроме replace)
      const quantityValue = quantity === null ? 0 : quantity;
      const priceValue = price === null ? 0 : price;
      
      // Дополнительная проверка: если количество 0 и это не режим replace, пропускаем
      if (quantityValue === 0 && mode !== 'replace' && mode !== 'remove') {
        if (i < 5) {
          console.log(`[Import Excel] Строка ${i + 1} (${name}): пропущена (количество = 0, режим: ${mode})`);
        }
        continue;
      }
      
      if (existingItem) {
        // Если товар с таким ключом уже есть в Excel файле (дубликат строки), обрабатываем количество
        // Логируем ВСЕ дубликаты для отладки
        console.log(`[Import Excel] ⚠️ ДУБЛИКАТ в Excel (строка ${i + 1}): "${name}" (артикул: ${article || 'нет'}), текущее количество в itemsMap: ${existingItem.quantity}, новое из строки: ${quantityValue}, будет: ${existingItem.quantity + quantityValue}`);
        
        if (mode === 'add') {
          // В режиме добавления суммируем количество только если оно указано
          // ВНИМАНИЕ: Если в Excel несколько строк с одним товаром, они суммируются здесь
          if (quantity !== null) {
            const oldQty = existingItem.quantity;
            existingItem.quantity += quantityValue;
            console.log(`[Import Excel] Суммирование: ${oldQty} + ${quantityValue} = ${existingItem.quantity}`);
          }
        } else if (mode === 'replace') {
          // В режиме замены берем последнее значение (перезаписываем, не суммируем)
          if (quantity !== null) {
            existingItem.quantity = Math.max(0, quantityValue);
          } else {
            // Если количество null, устанавливаем 0
            existingItem.quantity = 0;
          }
        } else if (mode === 'remove') {
          // В режиме удаления вычитаем количество только если оно указано
          if (quantity !== null) {
            existingItem.quantity = Math.max(0, existingItem.quantity - Math.abs(quantityValue));
          }
        }
        // Обновляем артикул и цену, если они не были заданы ранее
        if (!existingItem.article && article && article.length > 0) {
          existingItem.article = article;
        }
        if (!existingItem.price && priceValue > 0) {
          existingItem.price = priceValue;
        }
      } else {
        // Создаем новый элемент только если количество указано (или режим replace)
        if (quantity !== null || mode === 'replace') {
          // Логируем для первых нескольких товаров
          if (itemsMap.size < 5) {
            console.log(`[Import Excel] Новый товар в itemsMap: ${name}, количество: ${quantityValue}, артикул: ${article || 'нет'}`);
          }
          
          itemsMap.set(key, {
            originalName: name,
            quantity: Math.max(0, quantityValue), // Не допускаем отрицательные значения
            article: article && article.length > 0 ? article : undefined,
            price: Math.max(0, priceValue), // Не допускаем отрицательные цены
          });
        }
      }
    }

    if (itemsMap.size === 0) {
      return res.status(400).json({ message: 'Не найдено действительных товаров для импорта' });
    }

    let createdCount = 0;
    let updatedCount = 0;
    let removedCount = 0;
    let deletedCount = 0;

    // Режим удаления по артикулу
    if (mode === 'delete') {
      // Собираем все артикулы из Excel
      const articlesToDelete: string[] = [];
      for (const itemData of itemsMap.values()) {
        if (itemData.article && itemData.article.length > 0) {
          articlesToDelete.push(itemData.article);
        }
      }

      if (articlesToDelete.length === 0) {
        return res.status(400).json({ message: 'Не найдено артикулов для удаления. Убедитесь, что в колонке C указаны артикулы.' });
      }

      // Удаляем товары по артикулам
      const result = await WarehouseItem.deleteMany({ 
        article: { $in: articlesToDelete } 
      });
      
      deletedCount = result.deletedCount;

      res.status(200).json({ 
        message: `Удалено товаров по артикулам: ${deletedCount} из ${articlesToDelete.length}`,
        deleted: deletedCount,
        requested: articlesToDelete.length
      });
      return;
    }

    // Обрабатываем каждый товар из Excel для других режимов
    console.log(`[Import] Всего уникальных товаров в itemsMap: ${itemsMap.size}`);
    
    for (const itemData of itemsMap.values()) {
      // Логируем данные из itemsMap для ВСЕХ товаров для отладки
      console.log(`[Import] Обработка товара из itemsMap: "${itemData.originalName}", количество в itemsMap: ${itemData.quantity}, артикул: ${itemData.article || 'нет'}`);
      
      // Ищем существующий товар по артикулу или названию
      let existingItem = null;
      
      if (itemData.article && itemData.article.length > 0) {
        existingItem = await WarehouseItem.findOne({ article: itemData.article });
        if (existingItem) {
          console.log(`[Import] ✅ Найден товар по артикулу "${itemData.article}": ID: ${existingItem._id}, количество: ${existingItem.quantity}`);
        }
      }
      
      if (!existingItem) {
        // Ищем по названию (без учета регистра)
        existingItem = await WarehouseItem.findOne({ 
          name: { $regex: new RegExp(`^${itemData.originalName}$`, 'i') } 
        });
        if (existingItem) {
          console.log(`[Import] ✅ Найден товар по названию "${itemData.originalName}": ID: ${existingItem._id}, количество: ${existingItem.quantity}`);
        }
      }
      
      // Проверяем, нет ли других товаров с таким же артикулом или названием
      if (itemData.article && itemData.article.length > 0) {
        const allDuplicates = await WarehouseItem.find({ article: itemData.article });
        if (allDuplicates.length > 1) {
          console.error(`[Import] ⚠️ ОШИБКА: Найдено ${allDuplicates.length} товаров с артикулом "${itemData.article}"!`);
          allDuplicates.forEach((dup, idx) => {
            console.error(`[Import] Дубликат ${idx + 1}: ID: ${dup._id}, название: "${dup.name}", количество: ${dup.quantity}`);
          });
        }
      }

      if (existingItem) {
        const oldQuantity = existingItem.quantity || 0;
        const foundBy = itemData.article && itemData.article.length > 0 
          ? `артикул: ${itemData.article}` 
          : `название: "${itemData.originalName}"`;
        console.log(`[Import] ✅ НАЙДЕН существующий товар по ${foundBy}: "${itemData.originalName}", текущее количество в БД: ${oldQuantity}, ID: ${existingItem._id}`);
        
        // Обновляем существующий товар
        if (mode === 'add') {
          const newQuantity = oldQuantity + itemData.quantity;
          console.log(`[Import] ⚠️ Режим 'add': "${itemData.originalName}" - было в БД: ${oldQuantity}, добавляем из Excel: ${itemData.quantity}, будет: ${newQuantity}`);
          existingItem.quantity = newQuantity;
          updatedCount++;
        } else if (mode === 'replace') {
          existingItem.quantity = Math.max(0, itemData.quantity);
          // Логируем для первых нескольких товаров
          if (updatedCount < 5) {
            console.log(`[Import] Режим 'replace': ${itemData.originalName} - было ${oldQuantity}, заменяем на ${itemData.quantity}, стало ${existingItem.quantity}`);
          }
          updatedCount++;
        } else if (mode === 'remove') {
          const removeAmount = Math.abs(itemData.quantity);
          existingItem.quantity = Math.max(0, oldQuantity - removeAmount);
          // Логируем для первых нескольких товаров
          if (updatedCount < 5) {
            console.log(`[Import] Режим 'remove': ${itemData.originalName} - было ${oldQuantity}, вычитаем ${removeAmount}, стало ${existingItem.quantity}`);
          }
          if (existingItem.quantity === 0) {
            // Если количество стало 0, удаляем товар
            await WarehouseItem.findByIdAndDelete(existingItem._id);
            removedCount++;
            continue;
          } else {
            updatedCount++;
          }
        }
        
        // Обновляем артикул и цену, если они не были заданы ранее
        if (!existingItem.article && itemData.article) {
          existingItem.article = itemData.article;
        }
        if (!existingItem.price && itemData.price > 0) {
          existingItem.price = itemData.price;
        }
        
        await existingItem.save();
        console.log(`[Import] ✅ Товар обновлен и сохранен: "${itemData.originalName}", ID: ${existingItem._id}, количество: ${existingItem.quantity}`);
      } else {
        // Создаем новый товар только если режим не 'remove'
        if (mode !== 'remove') {
          console.log(`[Import] ➕ СОЗДАЕТСЯ новый товар: "${itemData.originalName}", количество: ${itemData.quantity}, артикул: ${itemData.article || 'нет'}`);
          const newItem = new WarehouseItem({
            name: itemData.originalName,
            quantity: Math.max(0, itemData.quantity), // Не допускаем отрицательные значения
            article: itemData.article,
            price: Math.max(0, itemData.price), // Не допускаем отрицательные цены
          });
          await newItem.save();
          console.log(`[Import] ✅ Новый товар создан: "${itemData.originalName}", ID: ${newItem._id}, количество: ${newItem.quantity}`);
          
          // Проверяем, что товар действительно сохранился с правильным количеством
          const savedItem = await WarehouseItem.findById(newItem._id);
          if (savedItem) {
            console.log(`[Import] ✅ Проверка после сохранения: ID: ${savedItem._id}, количество в БД: ${savedItem.quantity}, тип: ${typeof savedItem.quantity}`);
            if (savedItem.quantity !== itemData.quantity) {
              console.error(`[Import] ⚠️ ОШИБКА: Количество не совпадает! Ожидалось: ${itemData.quantity}, в БД: ${savedItem.quantity}`);
            }
          }
          
          // Проверяем, нет ли дубликатов в БД
          const duplicates = await WarehouseItem.find({
            $or: [
              { article: itemData.article },
              { name: { $regex: new RegExp(`^${itemData.originalName}$`, 'i') } }
            ]
          });
          if (duplicates.length > 1) {
            console.error(`[Import] ⚠️ ОШИБКА: Найдено ${duplicates.length} дубликатов товара "${itemData.originalName}" в БД!`);
            duplicates.forEach((dup, idx) => {
              console.error(`[Import] Дубликат ${idx + 1}: ID: ${dup._id}, количество: ${dup.quantity}`);
            });
          }
          
          createdCount++;
        } else {
          console.log(`[Import] ⏭️ Пропущен товар "${itemData.originalName}" (режим 'remove', новый товар не создается)`);
        }
      }
    }

    let message = '';
    if (mode === 'add') {
      message = `Импорт завершен: создано ${createdCount}, обновлено ${updatedCount}`;
    } else if (mode === 'replace') {
      message = `Импорт завершен: создано ${createdCount}, обновлено ${updatedCount}`;
    } else if (mode === 'remove') {
      message = `Удаление завершено: обновлено ${updatedCount}, удалено ${removedCount}`;
    }

    res.status(201).json({ 
      message,
      created: createdCount,
      updated: updatedCount,
      removed: removedCount
    });
  } catch (error) {
    console.error('Import warehouse items error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

/**
 * Экспорт товаров в Excel
 */
export const exportWarehouseItems = async (req: AuthRequest, res: Response) => {
  try {
    const { search, category } = req.query;
    
    const filter: any = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search as string, $options: 'i' } },
        { article: { $regex: search as string, $options: 'i' } }
      ];
    }

    if (category) {
      filter.category = category;
    }

    // Получаем все товары без пагинации
    const items = await WarehouseItem.find(filter)
      .sort({ category: 1, name: 1 })
      .lean();

    // Создаем Excel файл
    const workbook = XLSX.utils.book_new();
    
    // Подготавливаем данные
    const data = [
      ['Наименование', 'Количество', 'Артикул', 'Цена', 'Категория', 'Порог остатка', 'Дата создания', 'Дата обновления']
    ];

    items.forEach((item: any) => {
      data.push([
        item.name || '',
        item.quantity ?? 0,
        item.article || '',
        item.price ?? 0,
        item.category || '',
        item.lowStockThreshold ?? 0,
        item.createdAt ? new Date(item.createdAt).toLocaleDateString('ru-RU') : '',
        item.updatedAt ? new Date(item.updatedAt).toLocaleDateString('ru-RU') : ''
      ]);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(data);
    
    // Устанавливаем ширину колонок
    worksheet['!cols'] = [
      { wch: 30 }, // Наименование
      { wch: 12 }, // Количество
      { wch: 15 }, // Артикул
      { wch: 12 }, // Цена
      { wch: 20 }, // Категория
      { wch: 15 }, // Порог остатка
      { wch: 15 }, // Дата создания
      { wch: 15 }  // Дата обновления
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Товары');

    // Генерируем буфер
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Устанавливаем заголовки для скачивания
    const filename = `warehouse-export-${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    res.send(buffer);
  } catch (error) {
    console.error('Export warehouse items error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

/**
 * Получение списка категорий
 */
export const getCategories = async (req: AuthRequest, res: Response) => {
  try {
    // Проверка подключения к базе данных
    if (mongoose.connection.readyState !== 1) {
      console.error('MongoDB not connected. State:', mongoose.connection.readyState);
      return res.status(503).json({ 
        message: 'База данных недоступна. Попробуйте позже.' 
      });
    }

    const allCategories = await WarehouseItem.distinct('category');
    
    // Безопасная фильтрация и сортировка категорий
    const categories = allCategories
      .filter((cat: any) => {
        // Проверяем, что категория существует и является строкой
        if (!cat) return false;
        if (typeof cat !== 'string') return false;
        // Проверяем, что после trim есть содержимое
        const trimmed = cat.trim();
        return trimmed.length > 0;
      })
      .map((cat: any) => String(cat).trim())
      .sort();
    
    res.json({ categories });
  } catch (error: any) {
    console.error('Get categories error:', error);
    const errorMessage = error?.message || 'Ошибка сервера';
    res.status(500).json({ 
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * Получение товаров с низкими остатками
 */
export const getLowStockItems = async (req: AuthRequest, res: Response) => {
  try {
    // Проверка подключения к базе данных
    if (mongoose.connection.readyState !== 1) {
      console.error('MongoDB not connected. State:', mongoose.connection.readyState);
      return res.status(503).json({ 
        message: 'База данных недоступна. Попробуйте позже.' 
      });
    }

    // Более безопасный запрос для товаров с низкими остатками
    const items = await WarehouseItem.find({
      $or: [
        // Товары с количеством <= 0
        { 
          quantity: { 
            $exists: true, 
            $lte: 0 
          } 
        },
        // Товары, где quantity <= lowStockThreshold и lowStockThreshold > 0
        {
          $and: [
            { lowStockThreshold: { $exists: true, $gt: 0 } },
            {
              $expr: {
                $lte: [
                  { $ifNull: ['$quantity', 0] },
                  '$lowStockThreshold'
                ]
              }
            }
          ]
        }
      ]
    })
      .sort({ quantity: 1, name: 1 })
      .lean();

    // Безопасная обработка результатов
    const safeItems = items.map((item: any) => ({
      _id: item._id?.toString() || String(item._id),
      name: item.name || '',
      quantity: item.quantity ?? 0,
      article: item.article || '',
      price: item.price ?? 0,
      category: item.category || '',
      lowStockThreshold: item.lowStockThreshold ?? 0,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    }));

    res.json({ items: safeItems, count: safeItems.length });
  } catch (error: any) {
    console.error('Get low stock items error:', error);
    const errorMessage = error?.message || 'Ошибка сервера';
    res.status(500).json({ 
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

