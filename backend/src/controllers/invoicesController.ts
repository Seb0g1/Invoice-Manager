import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import Invoice from '../models/Invoice';
import Supplier from '../models/Supplier';
import BalanceHistory from '../models/BalanceHistory';
import User from '../models/User';
import { getUSDRate, convertUSDtoRUB } from '../services/currencyService';
import telegramService from '../services/telegramService';
import { format } from 'date-fns';
import fs from 'fs';
import path from 'path';

export const getInvoices = async (req: AuthRequest, res: Response) => {
  try {
    const { supplier, startDate, endDate } = req.query;
    
    const filter: any = {};
    
    if (supplier) {
      filter.supplier = supplier;
    }
    
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) {
        filter.date.$gte = new Date(startDate as string);
      }
      if (endDate) {
        filter.date.$lte = new Date(endDate as string);
      }
    }

    const invoices = await Invoice.find(filter)
      .populate('supplier', 'name')
      .sort({ date: -1 });

    res.json(invoices);
  } catch (error) {
    console.error('Get invoices error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

export const deleteInvoice = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { confirmDate } = req.body;

    const invoice = await Invoice.findById(id).populate('supplier');
    if (!invoice) {
      return res.status(404).json({ message: 'Накладная не найдена' });
    }

    // Проверка даты для подтверждения (формат: DD.MM.YYYY)
    const invoiceDate = format(new Date(invoice.date), 'dd.MM.yyyy');
    if (confirmDate !== invoiceDate) {
      return res.status(400).json({ message: 'Дата накладной не совпадает' });
    }

    // Если накладная не оплачена, отменяем изменение баланса
    // При удалении прихода: баланс уменьшается (отменяем увеличение)
    // При удалении возврата: баланс увеличивается (отменяем уменьшение)
    if (!invoice.paid) {
      const supplier = await Supplier.findById(invoice.supplier);
      if (supplier) {
        const isReturn = invoice.type === 'return';
        const amountRUB = invoice.amountRUB || 0;
        const amountUSD = invoice.amountUSD || 0;
        
        // Отменяем изменение баланса с учетом типа накладной
        const balanceChange = isReturn ? amountRUB : -amountRUB;
        const balanceChangeUSD = isReturn ? amountUSD : -amountUSD;
        
        supplier.balance += balanceChange;
        await supplier.save();

        // Добавляем запись в историю
        const exchangeRate = await getUSDRate();
        const newBalanceUSD = supplier.balance / exchangeRate;
        const historyEntry = new BalanceHistory({
          supplier: supplier._id,
          date: new Date(),
          change: balanceChange,
          changeUSD: balanceChangeUSD,
          newBalance: supplier.balance,
          newBalanceUSD,
          exchangeRate
        });
        await historyEntry.save();
      }
    } else if (invoice.paidAmountRUB && invoice.paidAmountRUB > 0) {
      // Если накладная была оплачена с указанием суммы, нужно отменить изменение баланса от оплаты
      const supplier = await Supplier.findById(invoice.supplier);
      if (supplier) {
        const isReturn = invoice.type === 'return';
        const amountRUB = invoice.amountRUB || 0;
        const amountUSD = invoice.amountUSD || 0;
        const paidAmountRUB = invoice.paidAmountRUB || 0;
        const paidAmountUSD = invoice.paidAmountUSD || 0;
        
        // Отменяем изменение баланса от оплаты
        let balanceChange: number;
        let balanceChangeUSD: number;
        if (isReturn) {
          // Возврат: отменяем уменьшение баланса от оплаты
          balanceChange = amountRUB - paidAmountRUB;
          balanceChangeUSD = amountUSD - paidAmountUSD;
        } else {
          // Приход: отменяем уменьшение баланса от оплаты
          balanceChange = paidAmountRUB - amountRUB;
          balanceChangeUSD = paidAmountUSD - amountUSD;
        }
        
        supplier.balance += balanceChange;
        await supplier.save();

        // Добавляем запись в историю
        const exchangeRate = await getUSDRate();
        const newBalanceUSD = supplier.balance / exchangeRate;
        const historyEntry = new BalanceHistory({
          supplier: supplier._id,
          date: new Date(),
          change: balanceChange,
          changeUSD: balanceChangeUSD,
          newBalance: supplier.balance,
          newBalanceUSD,
          exchangeRate
        });
        await historyEntry.save();
      }
    }

    // Сохраняем данные для уведомления
    const supplierName = (invoice.supplier as any)?.name || 'Неизвестный поставщик';
    const invoiceAmount = invoice.amountRUB || 0;
    const photoUrl = invoice.photoUrl;

    // Удаляем файл с сервера
    if (photoUrl) {
      try {
        // Извлекаем имя файла из пути (например, /uploads/filename.jpg -> filename.jpg)
        const filename = photoUrl.replace('/uploads/', '');
        const filePath = path.join(__dirname, '../../uploads', filename);
        
        // Проверяем существование файла и удаляем его
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`Файл удалён: ${filePath}`);
        } else {
          console.warn(`Файл не найден: ${filePath}`);
        }
      } catch (fileError) {
        // Логируем ошибку, но не прерываем удаление накладной
        console.error('Ошибка при удалении файла:', fileError);
      }
    }

    // Удаляем накладную
    await Invoice.findByIdAndDelete(id);

    // Отправляем уведомление в Telegram
    try {
      const user = await User.findById(req.userId);
      if (user) {
        await telegramService.notifyInvoiceDeleted(user.login, supplierName, invoiceAmount);
      }
    } catch (telegramError) {
      console.error('Telegram notification error:', telegramError);
    }

    res.json({ message: 'Накладная успешно удалена' });
  } catch (error) {
    console.error('Delete invoice error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

export const createInvoice = async (req: AuthRequest, res: Response) => {
  try {
    const { 
      date, 
      supplierId, 
      supplierName, 
      amountUSD, 
      amountRUB, 
      paid,
      paidAmountUSD,
      paidAmountRUB,
      type = 'income', // Тип накладной: income (приход) или return (возврат)
      comment // Комментарий к накладной
    } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: 'Фото накладной обязательно' });
    }

    let supplier;
    if (supplierId) {
      supplier = await Supplier.findById(supplierId);
      if (!supplier) {
        return res.status(404).json({ message: 'Поставщик не найден' });
      }
    } else if (supplierName && supplierName.trim()) {
      // Создаём нового поставщика
      supplier = new Supplier({ name: supplierName.trim() });
      await supplier.save();
    } else {
      return res.status(400).json({ message: 'Необходимо указать поставщика' });
    }

    // Получаем курс доллара
    const exchangeRate = await getUSDRate();
    
    let finalAmountUSD = 0;
    let finalAmountRUB = 0;

    if (amountUSD && parseFloat(amountUSD) > 0) {
      // Если указана сумма в долларах
      finalAmountUSD = parseFloat(amountUSD);
      finalAmountRUB = await convertUSDtoRUB(finalAmountUSD);
    } else if (amountRUB && parseFloat(amountRUB) > 0) {
      // Если указана сумма в рублях
      finalAmountRUB = parseFloat(amountRUB);
      finalAmountUSD = finalAmountRUB / exchangeRate;
    } else {
      // Дефолтная сумма 100 рублей
      finalAmountRUB = 100;
      finalAmountUSD = finalAmountRUB / exchangeRate;
    }

    const isPaid = paid === 'true' || paid === true;

    // Обрабатываем оплаченную сумму
    let finalPaidAmountUSD = 0;
    let finalPaidAmountRUB = 0;
    if (paidAmountUSD && parseFloat(paidAmountUSD) > 0) {
      finalPaidAmountUSD = parseFloat(paidAmountUSD);
      finalPaidAmountRUB = await convertUSDtoRUB(finalPaidAmountUSD);
    } else if (paidAmountRUB && parseFloat(paidAmountRUB) > 0) {
      finalPaidAmountRUB = parseFloat(paidAmountRUB);
      finalPaidAmountUSD = finalPaidAmountRUB / exchangeRate;
    }

    const invoice = new Invoice({
      photoUrl: `/uploads/${req.file.filename}`,
      date: date ? new Date(date) : new Date(),
      supplier: supplier._id,
      type: type === 'return' ? 'return' : 'income', // Сохраняем тип накладной
      amountUSD: finalAmountUSD,
      amountRUB: finalAmountRUB,
      exchangeRate,
      paid: isPaid || (finalPaidAmountRUB > 0),
      paidAmountUSD: finalPaidAmountUSD > 0 ? finalPaidAmountUSD : undefined,
      paidAmountRUB: finalPaidAmountRUB > 0 ? finalPaidAmountRUB : undefined,
      comment: comment && comment.trim() ? comment.trim() : undefined
    });

    await invoice.save();

    // Рассчитываем изменение баланса
    // Баланс = сколько мы должны поставщику (положительное) или сколько поставщик должен нам (отрицательное)
    // Приход (income): увеличивает долг поставщику (баланс увеличивается)
    // Возврат (return): уменьшает долг поставщику (баланс уменьшается)
    let balanceChange = 0;
    let balanceChangeUSD = 0;
    const isReturn = type === 'return';

    if (finalPaidAmountRUB > 0) {
      // Если указана оплаченная сумма
      // Для прихода: баланс = оплачено - сумма накладной (если оплатили больше, баланс уменьшается)
      // Для возврата: баланс = -(оплачено - сумма накладной) = сумма накладной - оплачено (если оплатили больше, баланс увеличивается)
      if (isReturn) {
        // Возврат: если оплатили возврат, баланс увеличивается (поставщик должен нам меньше)
        balanceChange = finalAmountRUB - finalPaidAmountRUB;
        balanceChangeUSD = finalAmountUSD - finalPaidAmountUSD;
      } else {
        // Приход: если оплатили приход, баланс уменьшается (мы должны поставщику меньше)
        balanceChange = finalPaidAmountRUB - finalAmountRUB;
        balanceChangeUSD = finalPaidAmountUSD - finalAmountUSD;
      }
    } else if (!isPaid) {
      // Если не указана оплаченная сумма и накладная не оплачена
      // Для прихода: баланс увеличивается (мы должны поставщику)
      // Для возврата: баланс уменьшается (поставщик должен нам меньше)
      balanceChange = isReturn ? -finalAmountRUB : finalAmountRUB;
      balanceChangeUSD = isReturn ? -finalAmountUSD : finalAmountUSD;
    }
    // Если isPaid = true и суммы не указаны, баланс не меняется

    // Обновляем баланс поставщика
    if (balanceChange !== 0) {
      const oldBalance = supplier.balance;
      supplier.balance += balanceChange;
      await supplier.save();

      // Добавляем запись в историю баланса
      const newBalanceUSD = supplier.balance / exchangeRate;
      const historyEntry = new BalanceHistory({
        supplier: supplier._id,
        date: new Date(),
        change: balanceChange,
        changeUSD: balanceChangeUSD,
        newBalance: supplier.balance,
        newBalanceUSD,
        exchangeRate
      });
      await historyEntry.save();

      // Отправляем уведомление в Telegram об изменении баланса
      try {
        const reason = isPaid 
          ? (finalPaidAmountRUB > 0 
              ? `Создана накладная с оплатой ${finalPaidAmountRUB.toLocaleString('ru-RU')} ₽`
              : 'Создана оплаченная накладная')
          : `Создана накладная на сумму ${finalAmountRUB.toLocaleString('ru-RU')} ₽`;
        
        await telegramService.notifySupplierBalanceChanged(
          supplier.name,
          oldBalance,
          supplier.balance,
          balanceChange,
          reason
        );
      } catch (telegramError) {
        // Не прерываем выполнение, если Telegram уведомление не отправилось
        console.error('Telegram notification error:', telegramError);
      }
    }

    const populatedInvoice = await Invoice.findById(invoice._id).populate('supplier', 'name');

    // Отправляем уведомление в Telegram
    try {
      const user = await User.findById(req.userId);
      if (user) {
        const path = require('path');
        const photoPath = req.file 
          ? path.join(__dirname, '../../uploads', req.file.filename)
          : undefined;
        const photoUrl = req.file 
          ? `${process.env.BACKEND_URL || 'http://localhost:5000'}${invoice.photoUrl}`
          : undefined;
        await telegramService.notifyInvoiceAdded(
          user.login,
          supplier.name,
          photoUrl,
          photoPath
        );
      }
    } catch (telegramError) {
      // Не прерываем выполнение, если Telegram уведомление не отправилось
      console.error('Telegram notification error:', telegramError);
    }

    res.status(201).json(populatedInvoice);
  } catch (error) {
    console.error('Create invoice error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

