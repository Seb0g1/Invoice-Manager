import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import PickingList from '../models/PickingList';
import PickingListItem from '../models/PickingListItem';
import Supplier from '../models/Supplier';
import User from '../models/User';
import telegramService from '../services/telegramService';
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
    const { date } = req.body;

    const pickingList = new PickingList({
      date: date ? new Date(date) : new Date()
    });

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

    // Получаем существующие товары для обновления
    const existingItems = await PickingListItem.find({ pickingList: pickingList._id });
    const existingItemsMap = new Map<string, typeof existingItems[0]>();
    existingItems.forEach(item => {
      const normalizedName = item.name.toLowerCase().trim();
      existingItemsMap.set(normalizedName, item);
    });

    // Словарь для группировки по названию (ключ: нормализованное название, значение: {originalName, quantity, price, supplierName})
    const itemsMap = new Map<string, { 
      originalName: string; 
      quantity: number; 
      price: number;
      supplierName?: string;
    }>();
    
    let currentSupplier: string | null = null;
    
    // Пропускаем заголовки (первую строку) и обрабатываем данные
    for (let i = 1; i < data.length; i++) {
      const row = data[i] as any[];
      if (!row || row.length === 0) continue;

      const name = String(row[0] || '').trim(); // Столбец A - наименование товара или поставщика
      const quantity = parseFloat(String(row[1] || '0')) || 0; // Столбец B - количество
      const price = parseFloat(String(row[2] || '0')) || 0; // Столбец C - цена
      const supplierName = String(row[3] || '').trim(); // Столбец D - поставщик

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
        // Обновляем поставщика, если он указан
        if (finalSupplierName) {
          existingItem.supplierName = finalSupplierName;
        }
      } else {
        // Создаем новый элемент
        itemsMap.set(normalizedName, {
          originalName: name,
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
