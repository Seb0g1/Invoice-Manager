import { Response } from 'express';
import { YandexProduct } from '../models/YandexProduct';
import { YandexProductBusinessLink } from '../models/YandexProductBusinessLink';
import { YandexBusiness } from '../models/YandexBusiness';
import { AuthRequest } from '../middleware/auth';

/**
 * Получить статистику по товарам
 */
export const getStats = async (req: AuthRequest, res: Response) => {
  try {
    // Общая статистика
    const totalProducts = await YandexProduct.countDocuments({});
    const totalBusinesses = await YandexBusiness.countDocuments({ enabled: true });
    const totalLinks = await YandexProductBusinessLink.countDocuments({});

    // Товары с остатками
    const productsWithStock = await YandexProductBusinessLink.countDocuments({
      'stock.available': { $gt: 0 },
    });

    // Товары без остатков
    const productsWithoutStock = await YandexProductBusinessLink.countDocuments({
      'stock.available': 0,
    });

    // Товары с ценами
    const productsWithPrice = await YandexProductBusinessLink.countDocuments({
      price: { $gt: 0 },
    });

    // Товары без цен
    const productsWithoutPrice = await YandexProductBusinessLink.countDocuments({
      price: 0,
    });

    // Статистика по бизнесам
    const businesses = await YandexBusiness.find({ enabled: true });
    const businessStats = await Promise.all(
      businesses.map(async (business) => {
        const links = await YandexProductBusinessLink.countDocuments({
          businessId: business.businessId,
        });
        const withStock = await YandexProductBusinessLink.countDocuments({
          businessId: business.businessId,
          'stock.available': { $gt: 0 },
        });
        const lastSync = await YandexProductBusinessLink.findOne(
          { businessId: business.businessId },
          {},
          { sort: { lastSync: -1 } }
        );

        return {
          businessId: business.businessId,
          businessName: business.name,
          totalProducts: links,
          productsWithStock: withStock,
          lastSync: lastSync?.lastSync || business.lastSyncAt,
        };
      })
    );

    // Средняя цена
    const priceStats = await YandexProductBusinessLink.aggregate([
      {
        $match: { price: { $gt: 0 } },
      },
      {
        $group: {
          _id: null,
          avgPrice: { $avg: '$price' },
          minPrice: { $min: '$price' },
          maxPrice: { $max: '$price' },
        },
      },
    ]);

    // Статистика по остаткам
    const stockStats = await YandexProductBusinessLink.aggregate([
      {
        $group: {
          _id: null,
          totalAvailable: { $sum: '$stock.available' },
          totalReserved: { $sum: '$stock.reserved' },
        },
      },
    ]);

    res.json({
      overview: {
        totalProducts,
        totalBusinesses,
        totalLinks,
        productsWithStock,
        productsWithoutStock,
        productsWithPrice,
        productsWithoutPrice,
      },
      prices: priceStats[0] || {
        avgPrice: 0,
        minPrice: 0,
        maxPrice: 0,
      },
      stocks: stockStats[0] || {
        totalAvailable: 0,
        totalReserved: 0,
      },
      businesses: businessStats,
    });
  } catch (error: any) {
    console.error('[YandexMarket] Ошибка получения статистики:', error);
    res.status(500).json({ message: error.message || 'Ошибка получения статистики' });
  }
};

