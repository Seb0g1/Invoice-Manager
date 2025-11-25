import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import WarehouseItem from '../models/WarehouseItem';
import * as XLSX from 'xlsx';

export const getWarehouseItems = async (req: AuthRequest, res: Response) => {
  try {
    const { search } = req.query;
    const filter: any = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search as string, $options: 'i' } },
        { article: { $regex: search as string, $options: 'i' } }
      ];
    }

    const items = await WarehouseItem.find(filter).sort({ name: 1 });
    res.json(items);
  } catch (error) {
    console.error('Get warehouse items error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
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
    const { name, quantity, article, price } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Наименование товара обязательно' });
    }

    const item = new WarehouseItem({
      name: name.trim(),
      quantity: quantity ? parseFloat(quantity) : undefined,
      article: article ? article.trim() : undefined,
      price: price ? parseFloat(price) : undefined,
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
    const { name, quantity, article, price } = req.body;

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

export const importWarehouseItems = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Excel файл обязателен' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    // Словарь для группировки по названию (ключ: нормализованное название, значение: {originalName, quantity, article, price})
    const itemsMap = new Map<string, { originalName: string; quantity: number; article?: string; price: number }>();
    
    // Пропускаем заголовок (если есть), начинаем с первой строки данных
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (row.length >= 1) { // Минимум колонка A (наименование)
        const name = row[0]?.toString().trim();
        const quantity = row[1] ? parseFloat(row[1]?.toString()) : 0;
        const article = row[2]?.toString().trim();
        const price = row[3] ? parseFloat(row[3]?.toString()) : 0;

        if (name && name.length > 0) {
          const normalizedName = name.toLowerCase();
          const existingItem = itemsMap.get(normalizedName);
          
          if (existingItem) {
            // Если товар с таким названием уже есть, суммируем количество
            existingItem.quantity += (!isNaN(quantity) && quantity > 0 ? quantity : 0);
            // Обновляем артикул и цену, если они не были заданы ранее
            if (!existingItem.article && article && article.length > 0) {
              existingItem.article = article;
            }
            if (!existingItem.price && !isNaN(price) && price > 0) {
              existingItem.price = price;
            }
          } else {
            // Создаем новый элемент
            itemsMap.set(normalizedName, {
              originalName: name, // Сохраняем оригинальное название
              quantity: !isNaN(quantity) && quantity > 0 ? quantity : 0,
              article: article && article.length > 0 ? article : undefined,
              price: !isNaN(price) && price > 0 ? price : 0,
            });
          }
        }
      }
    }

    // Преобразуем Map в массив для сохранения
    const newItems = Array.from(itemsMap.values()).map((data) => {
      return new WarehouseItem({
        name: data.originalName, // Сохраняем оригинальное название
        quantity: data.quantity,
        article: data.article,
        price: data.price,
      });
    });

    if (newItems.length === 0) {
      return res.status(400).json({ message: 'Не найдено действительных товаров для импорта' });
    }

    const savedItems = await WarehouseItem.insertMany(newItems);
    res.status(201).json({ 
      message: `${savedItems.length} товаров успешно импортировано`,
      items: savedItems
    });
  } catch (error) {
    console.error('Import warehouse items error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

