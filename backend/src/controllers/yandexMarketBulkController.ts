import { Response } from 'express';
import { yandexMarketService } from '../services/yandexMarketService';
import { YandexProduct } from '../models/YandexProduct';
import { YandexProductBusinessLink } from '../models/YandexProductBusinessLink';
import { YandexBusiness } from '../models/YandexBusiness';
import { AuthRequest } from '../middleware/auth';

/**
 * Массовое обновление цен для нескольких товаров
 */
export const bulkUpdatePrices = async (req: AuthRequest, res: Response) => {
  try {
    const { updates } = req.body; // Массив { vendorCode, price, currencyId }

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ message: 'Массив обновлений обязателен' });
    }

    const results: Array<{
      vendorCode: string;
      success: boolean;
      businesses: Array<{
        businessId: string;
        businessName: string;
        success: boolean;
        error?: string;
      }>;
    }> = [];

    // Обрабатываем каждый товар
    for (const update of updates) {
      const { vendorCode, price, currencyId = 'RUR' } = update;

      if (!vendorCode || !price) {
        results.push({
          vendorCode: vendorCode || 'unknown',
          success: false,
          businesses: [],
        });
        continue;
      }

      // Находим товар
      const product = await YandexProduct.findOne({ vendorCode });
      if (!product) {
        results.push({
          vendorCode,
          success: false,
          businesses: [],
        });
        continue;
      }

      // Находим все связи с бизнесами
      const links = await YandexProductBusinessLink.find({ productId: product._id });
      if (links.length === 0) {
        results.push({
          vendorCode,
          success: false,
          businesses: [],
        });
        continue;
      }

      // Группируем по бизнесам
      const businessGroups = new Map<string, Array<{ offerId: string }>>();
      for (const link of links) {
        if (!businessGroups.has(link.businessId)) {
          businessGroups.set(link.businessId, []);
        }
        businessGroups.get(link.businessId)!.push({ offerId: link.offerId });
      }

      const businessResults: Array<{
        businessId: string;
        businessName: string;
        success: boolean;
        error?: string;
      }> = [];

      // Обновляем цены в каждом бизнесе
      for (const [businessId, offers] of businessGroups) {
        try {
          const business = await YandexBusiness.findOne({ businessId });
          if (!business) {
            businessResults.push({
              businessId,
              businessName: businessId,
              success: false,
              error: 'Бизнес не найден',
            });
            continue;
          }

          const updateOffers = offers.map(offer => ({
            offerId: offer.offerId,
            price: {
              value: price.toString(),
              currencyId,
            },
          }));

          const updateResult = await yandexMarketService.updatePrices(businessId, updateOffers);

          if (updateResult.success) {
            // Обновляем цены в БД
            for (const link of links.filter(l => l.businessId === businessId)) {
              link.price = parseFloat(price);
              link.lastSync = new Date();
              await link.save();
            }
          }

          businessResults.push({
            businessId,
            businessName: business.name,
            success: updateResult.success,
            error: updateResult.errors?.[0]?.message,
          });
        } catch (error: any) {
          console.error(`[YandexMarket] Ошибка обновления цены для бизнеса ${businessId}:`, error.message);
          businessResults.push({
            businessId,
            businessName: businessId,
            success: false,
            error: error.message,
          });
        }
      }

      results.push({
        vendorCode,
        success: businessResults.every(r => r.success),
        businesses: businessResults,
      });
    }

    res.json({
      success: results.every(r => r.success),
      results,
    });
  } catch (error: any) {
    console.error('[YandexMarket] Ошибка массового обновления цен:', error);
    res.status(500).json({ message: error.message || 'Ошибка массового обновления цен' });
  }
};

