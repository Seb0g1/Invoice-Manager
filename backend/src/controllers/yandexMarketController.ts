import { Request, Response } from 'express';
import { yandexMarketService } from '../services/yandexMarketService';
import { YandexBusiness } from '../models/YandexBusiness';
import { YandexProduct } from '../models/YandexProduct';
import { YandexProductBusinessLink } from '../models/YandexProductBusinessLink';
import { AuthRequest } from '../middleware/auth';

/**
 * Полная синхронизация всех товаров из всех бизнесов
 */
export const syncAllProducts = async (req: AuthRequest, res: Response) => {
  try {
    // Получаем все активные бизнесы
    const businesses = await YandexBusiness.find({ enabled: true });
    
    if (businesses.length === 0) {
      return res.status(400).json({ message: 'Нет активных бизнесов для синхронизации' });
    }

    let totalSynced = 0;
    const errors: Array<{ businessId: string; error: string }> = [];

    // Синхронизируем каждый бизнес
    for (const business of businesses) {
      try {
        console.log(`[YandexMarket] Начало синхронизации бизнеса ${business.businessId} (${business.name})`);

        // Загружаем все офферы
        const offerMappings = await yandexMarketService.getOfferMappings(
          business.businessId,
          (current, total, stage) => {
            console.log(`[YandexMarket] ${business.businessId}: ${stage}`);
          }
        );

        console.log(`[YandexMarket] Загружено ${offerMappings.length} офферов для бизнеса ${business.businessId}`);

        // Обрабатываем каждый оффер
        for (const offer of offerMappings) {
          if (!offer.vendorCode) {
            // Пропускаем офферы без артикула
            continue;
          }

          // Находим или создаем товар по артикулу
          let product = await YandexProduct.findOne({ vendorCode: offer.vendorCode });

          if (!product) {
            // Создаем новый товар
            product = new YandexProduct({
              vendorCode: offer.vendorCode,
              name: offer.name || '',
              description: offer.description,
              images: offer.pictures || [],
              category: offer.category,
            });
            await product.save();
          } else {
            // Обновляем данные товара (берем самые свежие)
            if (offer.name) product.name = offer.name;
            if (offer.description) product.description = offer.description;
            if (offer.pictures && offer.pictures.length > 0) {
              product.images = offer.pictures;
            }
            if (offer.category) product.category = offer.category;
            await product.save();
          }

          // Находим или создаем связь товар-бизнес
          let link = await YandexProductBusinessLink.findOne({
            productId: product._id,
            businessId: business.businessId,
          });

          if (!link) {
            link = new YandexProductBusinessLink({
              productId: product._id,
              businessId: business.businessId,
              offerId: offer.offerId,
              sku: offer.marketSku?.toString() || '',
              price: 0,
              stock: { available: 0 },
              status: offer.status || offer.availability,
              lastSync: new Date(),
            });
          } else {
            // Обновляем связь
            link.offerId = offer.offerId;
            link.sku = offer.marketSku?.toString() || link.sku;
            link.status = offer.status || offer.availability || link.status;
            link.lastSync = new Date();
          }

          await link.save();
          totalSynced++;
        }

        // Обновляем время последней синхронизации бизнеса
        business.lastSyncAt = new Date();
        await business.save();

        console.log(`[YandexMarket] Бизнес ${business.businessId} синхронизирован: ${totalSynced} товаров`);
      } catch (error: any) {
        console.error(`[YandexMarket] Ошибка синхронизации бизнеса ${business.businessId}:`, error.message);
        errors.push({
          businessId: business.businessId,
          error: error.message,
        });
      }
    }

    res.json({
      success: errors.length === 0,
      totalSynced,
      businessesProcessed: businesses.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('[YandexMarket] Ошибка полной синхронизации:', error);
    res.status(500).json({ message: error.message || 'Ошибка синхронизации товаров' });
  }
};

/**
 * Синхронизация остатков для всех бизнесов
 */
export const syncStocks = async (req: AuthRequest, res: Response) => {
  try {
    const businesses = await YandexBusiness.find({ enabled: true });
    
    if (businesses.length === 0) {
      return res.status(400).json({ message: 'Нет активных бизнесов' });
    }

    let totalUpdated = 0;
    const errors: Array<{ businessId: string; error: string }> = [];

    for (const business of businesses) {
      try {
        console.log(`[YandexMarket] Синхронизация остатков для бизнеса ${business.businessId}`);

        // Получаем все связи для этого бизнеса
        const links = await YandexProductBusinessLink.find({ businessId: business.businessId });
        
        if (links.length === 0) {
          continue;
        }

        // Собираем SKU для запроса остатков
        const skus = links
          .map(link => link.sku)
          .filter(sku => sku && sku.length > 0);

        if (skus.length === 0) {
          continue;
        }

        // Загружаем остатки батчами по 1000
        const batchSize = 1000;
        for (let i = 0; i < skus.length; i += batchSize) {
          const batch = skus.slice(i, i + batchSize);
          const stocks = await yandexMarketService.getStocks(business.businessId, batch);

          // Обновляем остатки в связях
          for (const stockItem of stocks) {
            const link = links.find(l => l.sku === stockItem.sku);
            if (link) {
              // Суммируем остатки по всем складам
              let totalAvailable = 0;
              let totalReserved = 0;

              if (stockItem.items && Array.isArray(stockItem.items)) {
                stockItem.items.forEach((item: any) => {
                  if (item.type === 'AVAILABLE') {
                    totalAvailable += item.count || 0;
                  } else if (item.type === 'RESERVED') {
                    totalReserved += item.count || 0;
                  }
                });
              }

              link.stock = {
                available: totalAvailable,
                reserved: totalReserved,
              };
              link.lastSync = new Date();
              await link.save();
              totalUpdated++;
            }
          }

          // Задержка между батчами
          if (i + batchSize < skus.length) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }

        console.log(`[YandexMarket] Остатки для бизнеса ${business.businessId} обновлены`);
      } catch (error: any) {
        console.error(`[YandexMarket] Ошибка синхронизации остатков для бизнеса ${business.businessId}:`, error.message);
        errors.push({
          businessId: business.businessId,
          error: error.message,
        });
      }
    }

    res.json({
      success: errors.length === 0,
      totalUpdated,
      businessesProcessed: businesses.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('[YandexMarket] Ошибка синхронизации остатков:', error);
    res.status(500).json({ message: error.message || 'Ошибка синхронизации остатков' });
  }
};

/**
 * Синхронизация цен для всех бизнесов
 */
export const syncPrices = async (req: AuthRequest, res: Response) => {
  try {
    const businesses = await YandexBusiness.find({ enabled: true });
    
    if (businesses.length === 0) {
      return res.status(400).json({ message: 'Нет активных бизнесов' });
    }

    let totalUpdated = 0;
    const errors: Array<{ businessId: string; error: string }> = [];

    for (const business of businesses) {
      try {
        console.log(`[YandexMarket] Синхронизация цен для бизнеса ${business.businessId}`);

        // Загружаем все цены
        const prices = await yandexMarketService.getPrices(
          business.businessId,
          (current, total, stage) => {
            console.log(`[YandexMarket] ${business.businessId}: ${stage}`);
          }
        );

        // Обновляем цены в связях
        for (const priceItem of prices) {
          const link = await YandexProductBusinessLink.findOne({
            businessId: business.businessId,
            offerId: priceItem.offerId,
          });

          if (link && priceItem.price) {
            link.price = parseFloat(priceItem.price.value) || 0;
            link.lastSync = new Date();
            await link.save();
            totalUpdated++;
          }
        }

        console.log(`[YandexMarket] Цены для бизнеса ${business.businessId} обновлены`);
      } catch (error: any) {
        console.error(`[YandexMarket] Ошибка синхронизации цен для бизнеса ${business.businessId}:`, error.message);
        errors.push({
          businessId: business.businessId,
          error: error.message,
        });
      }
    }

    res.json({
      success: errors.length === 0,
      totalUpdated,
      businessesProcessed: businesses.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('[YandexMarket] Ошибка синхронизации цен:', error);
    res.status(500).json({ message: error.message || 'Ошибка синхронизации цен' });
  }
};

/**
 * Получить товар по артикулу со всеми бизнесами
 */
export const getProductByVendorCode = async (req: AuthRequest, res: Response) => {
  try {
    const { vendorCode } = req.params;

    if (!vendorCode) {
      return res.status(400).json({ message: 'Артикул не указан' });
    }

    // Находим товар
    const product = await YandexProduct.findOne({ vendorCode });

    if (!product) {
      return res.status(404).json({ message: 'Товар не найден' });
    }

    // Находим все связи с бизнесами
    const links = await YandexProductBusinessLink.find({ productId: product._id })
      .populate('productId')
      .sort({ businessId: 1 });

    // Получаем информацию о бизнесах
    const businessIds = [...new Set(links.map(link => link.businessId))];
    const businesses = await YandexBusiness.find({ businessId: { $in: businessIds } });

    const businessMap = new Map(businesses.map(b => [b.businessId, b]));

    // Формируем ответ
    const result = {
      product: {
        id: product._id,
        vendorCode: product.vendorCode,
        name: product.name,
        description: product.description,
        images: product.images,
        category: product.category,
      },
      businesses: links.map(link => {
        const business = businessMap.get(link.businessId);
        return {
          businessId: link.businessId,
          businessName: business?.name || link.businessId,
          offerId: link.offerId,
          sku: link.sku,
          price: link.price,
          stock: link.stock,
          status: link.status,
          lastSync: link.lastSync,
        };
      }),
    };

    res.json(result);
  } catch (error: any) {
    console.error('[YandexMarket] Ошибка получения товара:', error);
    res.status(500).json({ message: error.message || 'Ошибка получения товара' });
  }
};

/**
 * Обновить цену товара во всех бизнесах
 */
export const updatePriceInAllBusinesses = async (req: AuthRequest, res: Response) => {
  try {
    const { vendorCode, price, currencyId = 'RUR' } = req.body;

    if (!vendorCode || !price) {
      return res.status(400).json({ message: 'Артикул и цена обязательны' });
    }

    // Находим товар
    const product = await YandexProduct.findOne({ vendorCode });

    if (!product) {
      return res.status(404).json({ message: 'Товар не найден' });
    }

    // Находим все связи с бизнесами
    const links = await YandexProductBusinessLink.find({ productId: product._id });

    if (links.length === 0) {
      return res.status(404).json({ message: 'Товар не найден ни в одном бизнесе' });
    }

    // Группируем по бизнесам
    const businessGroups = new Map<string, Array<{ offerId: string }>>();
    
    for (const link of links) {
      if (!businessGroups.has(link.businessId)) {
        businessGroups.set(link.businessId, []);
      }
      businessGroups.get(link.businessId)!.push({ offerId: link.offerId });
    }

    const results: Array<{
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
          results.push({
            businessId,
            businessName: businessId,
            success: false,
            error: 'Бизнес не найден',
          });
          continue;
        }

        // Формируем запрос на обновление цен
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

        results.push({
          businessId,
          businessName: business.name,
          success: updateResult.success,
          error: updateResult.errors?.[0]?.message,
        });
      } catch (error: any) {
        console.error(`[YandexMarket] Ошибка обновления цены для бизнеса ${businessId}:`, error.message);
        results.push({
          businessId,
          businessName: businessId,
          success: false,
          error: error.message,
        });
      }
    }

    res.json({
      success: results.every(r => r.success),
      results,
    });
  } catch (error: any) {
    console.error('[YandexMarket] Ошибка обновления цены:', error);
    res.status(500).json({ message: error.message || 'Ошибка обновления цены' });
  }
};

/**
 * Поиск товаров по артикулу или названию
 */
export const searchProducts = async (req: AuthRequest, res: Response) => {
  try {
    const { q = '', limit = 50 } = req.query;

    const searchLimit = Math.min(parseInt(limit.toString()), 1000);

    // Поиск по артикулу или названию (если q пустой, возвращаем все)
    const query: any = {};
    if (q && typeof q === 'string' && q.trim()) {
      query.$or = [
        { vendorCode: { $regex: q, $options: 'i' } },
        { name: { $regex: q, $options: 'i' } },
      ];
    }

    const products = await YandexProduct.find(query)
      .limit(searchLimit)
      .sort({ name: 1 });

    res.json({
      products: products.map(p => ({
        id: p._id,
        vendorCode: p.vendorCode,
        name: p.name,
        images: p.images,
      })),
    });
  } catch (error: any) {
    console.error('[YandexMarket] Ошибка поиска товаров:', error);
    res.status(500).json({ message: error.message || 'Ошибка поиска товаров' });
  }
};

/**
 * Получить все товары с пагинацией
 */
export const getAllProducts = async (req: AuthRequest, res: Response) => {
  try {
    const { page = 1, limit = 50, search } = req.query;
    const pageNum = parseInt(page.toString());
    const limitNum = Math.min(parseInt(limit.toString()), 100);
    const skip = (pageNum - 1) * limitNum;

    const query: any = {};
    if (search && typeof search === 'string' && search.trim()) {
      query.$or = [
        { vendorCode: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
      ];
    }

    const [products, total] = await Promise.all([
      YandexProduct.find(query)
        .skip(skip)
        .limit(limitNum)
        .sort({ name: 1 }),
      YandexProduct.countDocuments(query),
    ]);

    // Загружаем связи с бизнесами для каждого товара
    const productsWithBusinesses = await Promise.all(
      products.map(async (product) => {
        const links = await YandexProductBusinessLink.find({ productId: product._id });
        const businessIds = [...new Set(links.map(l => l.businessId))];
        const businesses = await YandexBusiness.find({ businessId: { $in: businessIds } });
        const businessMap = new Map(businesses.map(b => [b.businessId, b]));

        return {
          id: product._id,
          vendorCode: product.vendorCode,
          name: product.name,
          description: product.description,
          images: product.images,
          category: product.category,
          businesses: links.map(link => {
            const business = businessMap.get(link.businessId);
            return {
              businessId: link.businessId,
              businessName: business?.name || link.businessId,
              offerId: link.offerId,
              price: link.price,
              stock: link.stock,
              status: link.status,
            };
          }),
        };
      })
    );

    res.json({
      products: productsWithBusinesses,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    console.error('[YandexMarket] Ошибка получения товаров:', error);
    res.status(500).json({ message: error.message || 'Ошибка получения товаров' });
  }
};

