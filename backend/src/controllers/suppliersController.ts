import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import Supplier from '../models/Supplier';
import Invoice from '../models/Invoice';
import BalanceHistory from '../models/BalanceHistory';
import { getUSDRate, convertRUBtoUSD } from '../services/currencyService';
import telegramService from '../services/telegramService';

export const getSuppliers = async (req: AuthRequest, res: Response) => {
  try {
    const suppliers = await Supplier.find().sort({ name: 1 });
    
    // Получаем курс для расчета баланса в USD
    const exchangeRate = await getUSDRate();
    const suppliersWithUSD = suppliers.map(supplier => ({
      ...supplier.toObject(),
      balanceUSD: supplier.balance / exchangeRate
    }));
    
    res.json(suppliersWithUSD);
  } catch (error) {
    console.error('Get suppliers error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

export const deleteSupplier = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { confirmName } = req.body;

    const supplier = await Supplier.findById(id);
    if (!supplier) {
      return res.status(404).json({ message: 'Поставщик не найден' });
    }

    // Проверка имени для подтверждения
    if (confirmName !== supplier.name) {
      return res.status(400).json({ message: 'Имя поставщика не совпадает' });
    }

    const supplierName = supplier.name;

    // Удаляем все связанные накладные и историю баланса
    await Invoice.deleteMany({ supplier: id });
    await BalanceHistory.deleteMany({ supplier: id });

    // Удаляем поставщика
    await Supplier.findByIdAndDelete(id);

    // Отправляем уведомление в Telegram
    try {
      const User = require('../models/User').default;
      const admin = await User.findById(req.userId);
      if (admin) {
        await telegramService.notifySupplierDeleted(admin.login, supplierName);
      }
    } catch (telegramError) {
      console.error('Telegram notification error:', telegramError);
    }

    res.json({ message: 'Поставщик успешно удалён' });
  } catch (error) {
    console.error('Delete supplier error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

export const getSupplierById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const supplier = await Supplier.findById(id);
    
    if (!supplier) {
      return res.status(404).json({ message: 'Поставщик не найден' });
    }

    const invoices = await Invoice.find({ supplier: id }).sort({ date: -1 });
    const balanceHistory = await BalanceHistory.find({ supplier: id }).sort({ date: 1 });

    // Получаем текущий курс для расчета баланса в USD
    const exchangeRate = await getUSDRate();
    const balanceUSD = supplier.balance / exchangeRate;

    res.json({
      supplier: {
        ...supplier.toObject(),
        balanceUSD
      },
      invoices,
      balanceHistory,
      exchangeRate
    });
  } catch (error) {
    console.error('Get supplier error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

export const createSupplier = async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Название поставщика обязательно' });
    }

    const supplier = new Supplier({ name: name.trim() });
    await supplier.save();

    // Отправляем уведомление в Telegram
    try {
      const User = require('../models/User').default;
      const admin = await User.findById(req.userId);
      if (admin) {
        await telegramService.notifySupplierCreated(admin.login, supplier.name);
      }
    } catch (telegramError) {
      console.error('Telegram notification error:', telegramError);
    }

    res.status(201).json(supplier);
  } catch (error: any) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Поставщик с таким именем уже существует' });
    }
    console.error('Create supplier error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

export const payInvoices = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { invoiceIds, customAmount } = req.body;

    const supplier = await Supplier.findById(id);
    if (!supplier) {
      return res.status(404).json({ message: 'Поставщик не найден' });
    }

    let invoicesToPay;
    if (invoiceIds === 'all') {
      invoicesToPay = await Invoice.find({ supplier: id, paid: false });
    } else if (Array.isArray(invoiceIds) && invoiceIds.length > 0) {
      invoicesToPay = await Invoice.find({
        _id: { $in: invoiceIds },
        supplier: id,
        paid: false
      });
    } else {
      return res.status(400).json({ message: 'Неверный формат запроса' });
    }

    if (invoicesToPay.length === 0) {
      return res.status(400).json({ message: 'Нет накладных для оплаты' });
    }

    let totalBalanceChangeRUB = 0;
    let totalBalanceChangeUSD = 0;

    // Если указана своя сумма, используем её
    if (customAmount !== undefined && customAmount !== null) {
      totalBalanceChangeRUB = -customAmount; // Отрицательное значение, так как мы платим (уменьшаем баланс)
      
      // Получаем текущий курс для расчета в USD
      const exchangeRate = await getUSDRate();
      totalBalanceChangeUSD = -customAmount / exchangeRate;
    } else {
      // Суммируем суммы из накладных с учетом типа
      // Для прихода: оплата уменьшает баланс (мы платим поставщику)
      // Для возврата: оплата увеличивает баланс (поставщик платит нам)
      invoicesToPay.forEach((inv) => {
        const isReturn = inv.type === 'return';
        const amountRUB = inv.amountRUB || 0;
        const amountUSD = inv.amountUSD || 0;
        
        if (isReturn) {
          // Возврат: при оплате баланс увеличивается
          totalBalanceChangeRUB += amountRUB;
          totalBalanceChangeUSD += amountUSD;
        } else {
          // Приход: при оплате баланс уменьшается
          totalBalanceChangeRUB -= amountRUB;
          totalBalanceChangeUSD -= amountUSD;
        }
      });
    }
    
    const newBalance = supplier.balance + totalBalanceChangeRUB;

    // Получаем текущий курс
    const exchangeRate = await getUSDRate();
    const newBalanceUSD = newBalance / exchangeRate;

    // Сохраняем старый баланс для уведомления
    const oldBalance = supplier.balance;

    // Обновляем баланс
    supplier.balance = newBalance;
    await supplier.save();

    // Помечаем накладные как оплаченные
    await Invoice.updateMany(
      { _id: { $in: invoicesToPay.map(inv => inv._id) } },
      { paid: true }
    );

    // Добавляем запись в историю
    const historyEntry = new BalanceHistory({
      supplier: id,
      date: new Date(),
      change: totalBalanceChangeRUB,
      changeUSD: totalBalanceChangeUSD,
      newBalance,
      newBalanceUSD,
      exchangeRate
    });
    await historyEntry.save();

    // Отправляем уведомление в Telegram об изменении баланса
    try {
      await telegramService.notifySupplierBalanceChanged(
        supplier.name,
        oldBalance,
        newBalance,
        totalBalanceChangeRUB,
        `Оплачено ${invoicesToPay.length} накладных`
      );
    } catch (telegramError) {
      // Не прерываем выполнение, если Telegram уведомление не отправилось
      console.error('Telegram notification error:', telegramError);
    }

    res.json({
      message: `Оплачено ${invoicesToPay.length} накладных`,
      newBalance,
      newBalanceUSD,
      paidCount: invoicesToPay.length
    });
  } catch (error) {
    console.error('Pay invoices error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

