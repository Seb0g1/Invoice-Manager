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
import { optimizeImage, deleteImageWithThumbnail } from '../utils/imageOptimizer';

export const getInvoices = async (req: AuthRequest, res: Response) => {
  try {
    const { supplier, startDate, endDate, page = '1', limit = '50' } = req.query;
    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = Math.min(parseInt(limit as string, 10) || 50, 200); // Максимум 200 на страницу
    const skip = (pageNum - 1) * limitNum;
    
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

    // Получаем общее количество для пагинации
    const total = await Invoice.countDocuments(filter);

    // Получаем накладные с пагинацией
    const invoices = await Invoice.find(filter)
      .populate('supplier', 'name')
      .populate('createdBy', 'login')
      .sort({ date: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    res.json({
      items: invoices,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
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

    // Удаляем файл с сервера (включая превью)
    if (photoUrl) {
      try {
        // Извлекаем имя файла из пути (например, /uploads/filename.jpg -> filename.jpg)
        const filename = photoUrl.replace('/uploads/', '');
        const filePath = path.join(__dirname, '../../uploads', filename);
        
        // Удаляем изображение и превью
        await deleteImageWithThumbnail(filePath);
        console.log(`Файл удалён: ${filePath}`);
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

    // Фото необязательно
    let finalPhotoUrl: string | undefined;
    if (req.file) {
      // Оптимизируем изображение
      const originalPath = path.join(__dirname, '../../uploads', req.file.filename);
      const optimizedFilename = `opt_${req.file.filename}`;
      const optimizedPath = path.join(__dirname, '../../uploads', optimizedFilename);
      
      try {
        const { optimizedPath: finalPath } = await optimizeImage(
          originalPath,
          optimizedPath,
          {
            maxWidth: 1920,
            maxHeight: 1920,
            quality: 85,
            format: 'jpeg',
            createThumbnail: true,
            thumbnailSize: 300
          }
        );

        // Удаляем оригинальное изображение, если оно было оптимизировано
        if (fs.existsSync(originalPath) && finalPath !== originalPath) {
          fs.unlinkSync(originalPath);
        }

        // Используем оптимизированное изображение
        finalPhotoUrl = `/uploads/${path.basename(finalPath)}`;
      } catch (optimizeError) {
        console.error('Image optimization error:', optimizeError);
        // Используем оригинальное изображение, если оптимизация не удалась
        finalPhotoUrl = `/uploads/${req.file.filename}`;
      }
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
    }
    // Если суммы не указаны, оставляем 0 (баланс не изменится)

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
      photoUrl: finalPhotoUrl,
      date: date ? new Date(date) : new Date(),
      supplier: supplier._id,
      createdBy: req.userId, // Сохраняем, кто создал накладную
      type: type === 'return' ? 'return' : 'income', // Сохраняем тип накладной
      amountUSD: finalAmountUSD > 0 ? finalAmountUSD : undefined,
      amountRUB: finalAmountRUB > 0 ? finalAmountRUB : undefined,
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
    // ВАЖНО: Если суммы не указаны (finalAmountRUB === 0), баланс НЕ изменяется
    let balanceChange = 0;
    let balanceChangeUSD = 0;
    const isReturn = type === 'return';

    // Баланс изменяется только если указана сумма накладной
    if (finalAmountRUB > 0) {
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
      // Если isPaid = true и оплаченная сумма не указана, баланс не меняется
    }
    // Если суммы не указаны (finalAmountRUB === 0), баланс не меняется

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
        const photoUrl = invoice.photoUrl 
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

/**
 * Получить статистику по накладным
 */
export const getInvoiceStatistics = async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    let filter: any = {};
    
    // Если это сборщик, показываем только его накладные
    if (user.role === 'collector') {
      filter.createdBy = req.userId;
    }

    // Общая статистика
    const totalInvoices = await Invoice.countDocuments(filter);
    const paidInvoices = await Invoice.countDocuments({ ...filter, paid: true });
    const unpaidInvoices = await Invoice.countDocuments({ ...filter, paid: false });
    
    // Статистика по типам
    const incomeInvoices = await Invoice.countDocuments({ ...filter, type: 'income' });
    const returnInvoices = await Invoice.countDocuments({ ...filter, type: 'return' });

    // Суммы
    const invoices = await Invoice.find(filter);
    const totalAmountRUB = invoices.reduce((sum, inv) => sum + (inv.amountRUB || 0), 0);
    const totalAmountUSD = invoices.reduce((sum, inv) => sum + (inv.amountUSD || 0), 0);
    const paidAmountRUB = invoices
      .filter(inv => inv.paid)
      .reduce((sum, inv) => sum + (inv.paidAmountRUB || inv.amountRUB || 0), 0);
    const paidAmountUSD = invoices
      .filter(inv => inv.paid)
      .reduce((sum, inv) => sum + (inv.paidAmountUSD || inv.amountUSD || 0), 0);
    const unpaidAmountRUB = totalAmountRUB - paidAmountRUB;
    const unpaidAmountUSD = totalAmountUSD - paidAmountUSD;

    // Статистика по сборщикам (только для директора)
    let collectorsStats: Array<{
      userId: string;
      login: string;
      totalInvoices: number;
      paidInvoices: number;
      unpaidInvoices: number;
      totalAmountRUB: number;
      totalAmountUSD: number;
    }> = [];

    if (user.role === 'director') {
      const collectors = await User.find({ role: 'collector' });
      const statsPromises = collectors.map(async (collector) => {
        const collectorFilter = { createdBy: collector._id };
        const collectorInvoices = await Invoice.find(collectorFilter);
        const collectorTotal = collectorInvoices.length;
        const collectorPaid = collectorInvoices.filter(inv => inv.paid).length;
        const collectorUnpaid = collectorTotal - collectorPaid;
        const collectorAmountRUB = collectorInvoices.reduce((sum, inv) => sum + (inv.amountRUB || 0), 0);
        const collectorAmountUSD = collectorInvoices.reduce((sum, inv) => sum + (inv.amountUSD || 0), 0);

        return {
          userId: collector._id.toString(),
          login: collector.login,
          totalInvoices: collectorTotal,
          paidInvoices: collectorPaid,
          unpaidInvoices: collectorUnpaid,
          totalAmountRUB: collectorAmountRUB,
          totalAmountUSD: collectorAmountUSD,
        };
      });

      collectorsStats = await Promise.all(statsPromises);
    }

    // Статистика по месяцам (последние 6 месяцев)
    const monthlyStats: Array<{
      month: string;
      count: number;
      amountRUB: number;
      amountUSD: number;
    }> = [];

    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);

      const monthFilter = {
        ...filter,
        date: {
          $gte: startOfMonth,
          $lte: endOfMonth
        }
      };

      const monthInvoices = await Invoice.find(monthFilter);
      const monthCount = monthInvoices.length;
      const monthAmountRUB = monthInvoices.reduce((sum, inv) => sum + (inv.amountRUB || 0), 0);
      const monthAmountUSD = monthInvoices.reduce((sum, inv) => sum + (inv.amountUSD || 0), 0);

      monthlyStats.push({
        month: date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }),
        count: monthCount,
        amountRUB: monthAmountRUB,
        amountUSD: monthAmountUSD,
      });
    }

    res.json({
      totalInvoices,
      paidInvoices,
      unpaidInvoices,
      incomeInvoices,
      returnInvoices,
      totalAmountRUB,
      totalAmountUSD,
      paidAmountRUB,
      paidAmountUSD,
      unpaidAmountRUB,
      unpaidAmountUSD,
      collectorsStats,
      monthlyStats,
    });
  } catch (error) {
    console.error('Get invoice statistics error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

