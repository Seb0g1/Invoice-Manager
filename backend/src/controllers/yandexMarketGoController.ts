import { Response } from 'express';
import { yandexMarketGoService } from '../services/yandexMarketGoService';
import { YandexBusiness } from '../models/YandexBusiness';
import { YandexProduct } from '../models/YandexProduct';
import { YandexProductBusinessLink } from '../models/YandexProductBusinessLink';
import { AuthRequest } from '../middleware/auth';

// Глобальное хранилище прогресса синхронизации
let syncProgressState: {
  current: number;
  total: number;
  stage: string;
  status: 'processing' | 'completed' | 'error';
  result?: {
    total: number;
    synced: number;
    errors: number;
    businessesProcessed: number;
  };
  error?: string;
} | null = null;

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

    // Инициализируем прогресс
    syncProgressState = {
      current: 0,
      total: 0,
      stage: 'Инициализация...',
      status: 'processing',
    };

    // Отправляем ответ сразу, чтобы не блокировать запрос
    res.json({
      message: 'Синхронизация запущена',
      status: 'processing',
    });

    // Получаем лимит из query параметров или используем значение по умолчанию
    const maxOffersPerBusiness = req.query.maxOffers 
      ? parseInt(req.query.maxOffers.toString()) 
      : 1000000; // По умолчанию 1,000,000 товаров (практически без ограничений)

    // Запускаем синхронизацию асинхронно
    (async () => {
      try {
        let totalSynced = 0;
        let totalProducts = 0;
        const errors: Array<{ businessId: string; error: string }> = [];
        const startTime = Date.now();

        // Синхронизируем каждый бизнес
        for (let businessIndex = 0; businessIndex < businesses.length; businessIndex++) {
          const business = businesses[businessIndex];
          try {
            const businessProgress = `Бизнес ${businessIndex + 1}/${businesses.length}: ${business.name}`;
            syncProgressState = {
              current: totalSynced,
              total: totalProducts || businesses.length * maxOffersPerBusiness,
              stage: `${businessProgress} - Загрузка офферов...`,
              status: 'processing',
            };

            console.log(`[YandexMarketGo] Начало синхронизации бизнеса ${business.businessId} (${business.name}), лимит: ${maxOffersPerBusiness}`);

            // Загружаем офферы с лимитом
            let offerMappings: any[] = [];
            try {
              offerMappings = await yandexMarketGoService.getOfferMappings(
                business.businessId,
                (current, total, stage) => {
                  syncProgressState = {
                    current: totalSynced,
                    total: totalProducts || total,
                    stage: `${businessProgress} - ${stage}`,
                    status: 'processing',
                  };
                  console.log(`[YandexMarketGo] ${business.businessId}: ${stage}`);
                },
                maxOffersPerBusiness // Передаем лимит
              );
            } catch (offerError: any) {
              console.error(`[YandexMarketGo] Ошибка загрузки офферов для бизнеса ${business.businessId}:`, offerError.message);
              errors.push({
                businessId: business.businessId,
                error: offerError.message || 'Ошибка загрузки офферов',
              });
              continue; // Пропускаем этот бизнес и продолжаем со следующим
            }

            totalProducts = Math.max(totalProducts, offerMappings.length);
            console.log(`[YandexMarketGo] Загружено ${offerMappings.length} офферов для бизнеса ${business.businessId}`);

            if (offerMappings.length === 0) {
              console.warn(`[YandexMarketGo] Нет офферов для бизнеса ${business.businessId}, пропускаем`);
              continue;
            }

            // Получаем offerIds для запроса информации о карточках и остатках
            // Нормализуем offerIds (убираем пробелы в начале/конце) для совпадения с ключами в stocksMap
            const offerIds = offerMappings
              .map(offer => offer.offerId?.trim())
              .filter(id => id && id.length > 0);

            // Получаем информацию о карточках товаров (название, изображения и т.д.)
            console.log(`[YandexMarketGo] Загрузка информации о карточках для ${offerIds.length} товаров...`);
            syncProgressState = {
              current: totalSynced,
              total: totalProducts,
              stage: `${businessProgress} - Загрузка информации о карточках...`,
              status: 'processing',
            };
            
            let offerCardsMap: Map<string, any>;
            try {
              offerCardsMap = await yandexMarketGoService.getOfferCards(
                business.businessId,
                offerIds,
                (current, total, stage) => {
                  syncProgressState = {
                    current: totalSynced,
                    total: totalProducts,
                    stage: `${businessProgress} - ${stage}`,
                    status: 'processing',
                  };
                }
              );
              console.log(`[YandexMarketGo] Загружено карточек: ${offerCardsMap.size}`);
            } catch (cardsError: any) {
              console.warn(`[YandexMarketGo] Ошибка загрузки карточек: ${cardsError.message}, продолжаем без них`);
              offerCardsMap = new Map();
            }

            // Получаем изображения через отдельный запрос к offer-mappings
            console.log(`[YandexMarketGo] Загрузка изображений для ${offerIds.length} товаров...`);
            syncProgressState = {
              current: totalSynced,
              total: totalProducts,
              stage: `${businessProgress} - Загрузка изображений...`,
              status: 'processing',
            };
            
            let imagesMap: Map<string, string[]>;
            try {
              imagesMap = await yandexMarketGoService.getOfferMappingsWithImages(
                business.businessId,
                offerIds,
                (current, total, stage) => {
                  syncProgressState = {
                    current: totalSynced,
                    total: totalProducts,
                    stage: `${businessProgress} - ${stage}`,
                    status: 'processing',
                  };
                }
              );
              console.log(`[YandexMarketGo] Загружено изображений для ${imagesMap.size} товаров`);
            } catch (imagesError: any) {
              console.warn(`[YandexMarketGo] Ошибка загрузки изображений: ${imagesError.message}, продолжаем без них`);
              imagesMap = new Map();
            }

            // Получаем остатки товаров
            console.log(`[YandexMarketGo] Загрузка остатков для ${offerIds.length} товаров...`);
            console.log(`[YandexMarketGo] Первые 10 offerIds:`, offerIds.slice(0, 10));
            syncProgressState = {
              current: totalSynced,
              total: totalProducts,
              stage: `${businessProgress} - Загрузка остатков...`,
              status: 'processing',
            };
            
            let stocksMap: Map<string, { available: number; reserved: number }>;
            try {
              stocksMap = await yandexMarketGoService.getStocks(
                business.businessId,
                offerIds,
                (current, total, stage) => {
                  syncProgressState = {
                    current: totalSynced,
                    total: totalProducts,
                    stage: `${businessProgress} - ${stage}`,
                    status: 'processing',
                  };
                }
              );
              console.log(`[YandexMarketGo] Загружено остатков: ${stocksMap.size} из ${offerIds.length}`);
              if (stocksMap.size > 0) {
                // Логируем примеры остатков
                const firstStock = Array.from(stocksMap.entries())[0];
                console.log(`[YandexMarketGo] Пример остатка: offerId=${firstStock[0]}, available=${firstStock[1].available}, reserved=${firstStock[1].reserved}`);
                // Логируем все ключи в stocksMap (первые 20)
                console.log(`[YandexMarketGo] Первые 20 ключей в stocksMap:`, Array.from(stocksMap.keys()).slice(0, 20));
              } else {
                console.warn(`[YandexMarketGo] Не получено ни одного остатка для ${offerIds.length} товаров!`);
                console.warn(`[YandexMarketGo] Возможно, API не возвращает остатки или они в другом формате`);
              }
            } catch (stocksError: any) {
              console.error(`[YandexMarketGo] Ошибка загрузки остатков: ${stocksError.message}`);
              console.error(`[YandexMarketGo] Stack:`, stocksError.stack);
              console.error(`[YandexMarketGo] Response data:`, stocksError.response?.data);
              stocksMap = new Map();
            }

            // Обрабатываем каждый оффер батчами
            const batchSize = 100;
            let offersWithVendorCode = 0;
            let offersWithoutVendorCode = 0;
            
            for (let i = 0; i < offerMappings.length; i += batchSize) {
              const batch = offerMappings.slice(i, i + batchSize);

              for (const offer of batch) {
            // В новом API offerId = SKU = vendorCode (идентификатор товара)
            // Пробуем разные варианты получения артикула
            const vendorCode = offer.vendorCode || 
                              offer.offerId || // В новом API это основной идентификатор
                              offer.marketSku?.toString();
            
            if (!vendorCode) {
              // Пропускаем офферы без артикула
              offersWithoutVendorCode++;
              console.debug(`[YandexMarketGo] Пропущен оффер ${offer.offerId || 'unknown'} без артикула`);
              continue;
            }
            
            offersWithVendorCode++;

            // Получаем информацию о карточке товара
            const offerCard = offerCardsMap.get(offer.offerId);
            
            // Нормализуем ключи для поиска (убираем пробелы в начале/конце)
            const normalizedOfferId = offer.offerId?.trim();
            const normalizedVendorCode = vendorCode?.trim();
            
            // Пробуем найти остаток по offerId, если не найдено - пробуем по vendorCode
            let stockInfo = stocksMap.get(normalizedOfferId) || stocksMap.get(normalizedVendorCode) || { available: 0, reserved: 0 };
            
            // Если не нашли, пробуем найти по всем ключам с учетом возможных различий в форматировании
            if (stockInfo.available === 0 && stockInfo.reserved === 0 && stocksMap.size > 0) {
              // Ищем по частичному совпадению (если offerId содержит vendorCode или наоборот)
              for (const [key, value] of stocksMap.entries()) {
                const normalizedKey = key.trim();
                if (normalizedKey === normalizedOfferId || normalizedKey === normalizedVendorCode) {
                  stockInfo = value;
                  break;
                }
                // Проверяем, содержит ли ключ offerId или vendorCode (или наоборот)
                if (normalizedOfferId && (normalizedKey.includes(normalizedOfferId) || normalizedOfferId.includes(normalizedKey))) {
                  stockInfo = value;
                  break;
                }
                if (normalizedVendorCode && (normalizedKey.includes(normalizedVendorCode) || normalizedVendorCode.includes(normalizedKey))) {
                  stockInfo = value;
                  break;
                }
              }
            }
            
            // Логируем, если остаток не найден (только для первых нескольких товаров для отладки)
            if (offersWithVendorCode <= 10 && stockInfo.available === 0 && stockInfo.reserved === 0 && stocksMap.size > 0) {
              console.log(`[YandexMarketGo] Остаток не найден для offerId="${normalizedOfferId}", vendorCode="${normalizedVendorCode}"`);
              console.log(`[YandexMarketGo] Типы: offerId type=${typeof normalizedOfferId}, vendorCode type=${typeof normalizedVendorCode}`);
              console.log(`[YandexMarketGo] Длины: offerId length=${normalizedOfferId?.length}, vendorCode length=${normalizedVendorCode?.length}`);
              
              // Показываем первые несколько ключей с их типами и длинами
              const sampleKeys = Array.from(stocksMap.keys()).slice(0, 5);
              console.log(`[YandexMarketGo] Примеры ключей в stocksMap:`, sampleKeys.map(k => ({
                key: k,
                type: typeof k,
                length: k?.length,
                matchesOfferId: k === normalizedOfferId,
                matchesVendorCode: k === normalizedVendorCode
              })));
            }

            // Определяем название товара
            // Приоритет: offerCard.mapping.marketSkuName > offer.name > offerId
            let productName = offerCard?.mapping?.marketSkuName;
            if (!productName || !productName.trim()) {
              productName = offer.name && offer.name.trim() ? offer.name : undefined;
            }
            if (!productName || !productName.trim()) {
              productName = offer.offerId || vendorCode || 'Товар без названия';
            }

            // Определяем изображения
            // Приоритет: imagesMap (отдельный запрос) > offer.pictures > offerCard.pictures > offerCard.photo/photos
            let images: string[] = [];
            
            // 1. Из отдельного запроса к offer-mappings (самый надежный источник)
            // normalizedOfferId уже объявлен выше
            if (normalizedOfferId && imagesMap.has(normalizedOfferId)) {
              images = imagesMap.get(normalizedOfferId) || [];
            }
            
            // 2. Из offer-mappings (поле pictures в текущем ответе)
            if (images.length === 0 && offer.pictures && Array.isArray(offer.pictures) && offer.pictures.length > 0) {
              images = offer.pictures.filter((url: string) => url && url.trim().length > 0);
            }
            
            // 3. Из offer-cards (поле pictures)
            if (images.length === 0 && offerCard?.pictures && Array.isArray(offerCard.pictures) && offerCard.pictures.length > 0) {
              images = offerCard.pictures.filter((url: string) => url && url.trim().length > 0);
            }
            
            // 4. Из offer-cards (поле photo)
            if (images.length === 0 && offerCard?.photo?.url) {
              images = [offerCard.photo.url];
            }
            
            // 5. Из offer-cards (поле photos - массив)
            if (images.length === 0 && offerCard?.photos && Array.isArray(offerCard.photos) && offerCard.photos.length > 0) {
              images = offerCard.photos
                .map((photo: any) => photo.url || photo)
                .filter((url: string) => url && url.trim().length > 0);
            }
            
            // Логируем получение изображений для первых нескольких товаров
            if (offersWithVendorCode <= 5) {
              console.log(`[YandexMarketGo] Изображения для товара ${vendorCode}:`, {
                fromImagesMap: imagesMap.has(normalizedOfferId || '') ? 1 : 0,
                fromOffer: offer.pictures?.length || 0,
                fromOfferCard: offerCard?.pictures?.length || 0,
                fromPhoto: offerCard?.photo?.url ? 1 : 0,
                fromPhotos: offerCard?.photos?.length || 0,
                totalImages: images.length,
                images: images.slice(0, 3), // Первые 3 изображения
              });
            }

            // Определяем категорию
            const category = offerCard?.mapping?.marketCategoryName || offer.category;

            // Находим или создаем товар по артикулу
            let product = await YandexProduct.findOne({ vendorCode: vendorCode });

            if (!product) {
              // Создаем новый товар
              product = new YandexProduct({
                vendorCode: vendorCode,
                name: productName,
                description: offer.description,
                images: images,
                category: category,
              });
              await product.save();
            } else {
              // Обновляем данные товара (берем самые свежие)
              // Обновляем название только если оно не пустое и не является артикулом
              if (productName && productName.trim() && productName !== vendorCode && productName !== offer.offerId) {
                product.name = productName;
              } else if (!product.name || product.name.trim() === '' || product.name === vendorCode) {
                // Если у товара нет названия или оно равно артикулу, обновляем
                product.name = productName;
              }
              if (offer.description) product.description = offer.description;
              // Обновляем изображения если есть новые (даже если уже были старые)
              if (images.length > 0) {
                product.images = images;
              } else if (product.images.length === 0) {
                // Если у товара нет изображений, оставляем пустым
                product.images = [];
              }
              if (category) product.category = category;
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
                sku: offerCard?.mapping?.marketSku?.toString() || offer.marketSku?.toString() || '',
                price: offer.pricing?.value ? parseFloat(offer.pricing.value) : 0,
                stock: {
                  available: stockInfo.available,
                  reserved: stockInfo.reserved,
                },
                status: offer.status || offer.availability,
                lastSync: new Date(),
              });
            } else {
              // Обновляем связь
              link.offerId = offer.offerId;
              link.sku = offerCard?.mapping?.marketSku?.toString() || offer.marketSku?.toString() || link.sku;
              link.status = offer.status || offer.availability || link.status;
              if (offer.pricing?.value) {
                link.price = parseFloat(offer.pricing.value);
              }
              link.stock = {
                available: stockInfo.available,
                reserved: stockInfo.reserved,
              };
              link.lastSync = new Date();
            }

            // Не логируем каждый товар без остатка, чтобы не засорять логи

                await link.save();
                totalSynced++;
                
                // Обновляем прогресс
                syncProgressState = {
                  current: totalSynced,
                  total: totalProducts,
                  stage: `${businessProgress} - Обработано: ${totalSynced}`,
                  status: 'processing',
                };
              }

              // Задержка между батчами
              if (i + batchSize < offerMappings.length) {
                await new Promise(resolve => setTimeout(resolve, 200));
              }
            }

            // Обновляем время последней синхронизации бизнеса
            business.lastSyncAt = new Date();
            await business.save();

            // Подсчитываем товары с остатками
            const linksWithStock = await YandexProductBusinessLink.countDocuments({
              businessId: business.businessId,
              'stock.available': { $gt: 0 },
            });
            
            console.log(`[YandexMarketGo] Бизнес ${business.businessId} синхронизирован:`);
            console.log(`  - Всего офферов: ${offerMappings.length}`);
            console.log(`  - С артикулом: ${offersWithVendorCode}`);
            console.log(`  - Без артикула: ${offersWithoutVendorCode}`);
            console.log(`  - Синхронизировано товаров: ${totalSynced}`);
            console.log(`  - Товаров с остатками: ${linksWithStock}`);
            console.log(`  - Загружено остатков из API: ${stocksMap.size}`);
          } catch (error: any) {
            console.error(`[YandexMarketGo] Ошибка синхронизации бизнеса ${business.businessId}:`, error.message);
            errors.push({
              businessId: business.businessId,
              error: error.message,
            });
          }
        }

        const duration = Math.round((Date.now() - startTime) / 1000);

        // Завершаем синхронизацию
        syncProgressState = {
          current: totalSynced,
          total: totalProducts,
          stage: 'Синхронизация завершена',
          status: errors.length === 0 ? 'completed' : 'error',
          result: {
            total: totalProducts,
            synced: totalSynced,
            errors: errors.length,
            businessesProcessed: businesses.length,
          },
          error: errors.length > 0 ? `Ошибки в ${errors.length} бизнесах` : undefined,
        };

        console.log(`[YandexMarketGo] Синхронизация завершена: ${totalSynced} товаров за ${duration}с`);
      } catch (error: any) {
        console.error('[YandexMarketGo] Критическая ошибка синхронизации:', error);
        console.error('[YandexMarketGo] Stack trace:', error.stack);
        syncProgressState = {
          current: 0,
          total: 0,
          stage: 'Ошибка синхронизации',
          status: 'error',
          error: error.message || 'Неизвестная ошибка',
        };
      }
    })();
  } catch (error: any) {
    console.error('[YandexMarketGo] Ошибка запуска синхронизации:', error);
    console.error('[YandexMarketGo] Stack trace:', error.stack);
    res.status(500).json({ 
      message: error.message || 'Ошибка запуска синхронизации',
      error: error.toString(),
    });
  }
};

/**
 * Получить прогресс синхронизации
 */
export const getSyncProgress = async (req: AuthRequest, res: Response) => {
  try {
    if (!syncProgressState) {
      return res.json({
        status: 'idle',
        message: 'Синхронизация не запущена',
      });
    }

    const response = {
      status: syncProgressState.status,
      progress: {
        current: syncProgressState.current,
        total: syncProgressState.total,
        stage: syncProgressState.stage,
      },
      result: syncProgressState.result,
      error: syncProgressState.error,
    };

    // Очищаем состояние через 5 минут после завершения/ошибки
    if ((syncProgressState.status === 'completed' || syncProgressState.status === 'error') && syncProgressState.result) {
      setTimeout(() => {
        syncProgressState = null;
      }, 5 * 60 * 1000);
    }

    res.json(response);
  } catch (error: any) {
    console.error('[YandexMarketGo] Ошибка получения прогресса:', error);
    res.status(500).json({
      message: error.message || 'Ошибка при получении прогресса синхронизации'
    });
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
        console.log(`[YandexMarketGo] Синхронизация остатков для бизнеса ${business.businessId}`);

        // Получаем все связи для этого бизнеса
        const links = await YandexProductBusinessLink.find({ businessId: business.businessId });
        
        if (links.length === 0) {
          continue;
        }

        // Собираем offerIds для запроса остатков
        const offerIds = links
          .map(link => link.offerId)
          .filter(offerId => offerId && offerId.length > 0);

        if (offerIds.length === 0) {
          continue;
        }

        // Загружаем остатки батчами
        const stocks = await yandexMarketGoService.getStocks(business.businessId, offerIds);

        // Создаем мапу для быстрого поиска
        const stocksMap = new Map<string, any>();
        stocks.forEach((stock: any) => {
          // StockItem может иметь offerId или sku
          const key = stock.offerId || stock.sku?.toString();
          if (key) {
            stocksMap.set(key, stock);
          }
        });

        // Обновляем остатки в связях
        for (const link of links) {
          const stockItem = stocksMap.get(link.offerId);
          if (stockItem) {
            // Суммируем остатки по всем складам
            let totalAvailable = 0;
            let totalReserved = 0;

            if (stockItem.items && Array.isArray(stockItem.items)) {
              stockItem.items.forEach((item: any) => {
                if (item.type === 'AVAILABLE' || item.type === 'FIT') {
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

        console.log(`[YandexMarketGo] Остатки для бизнеса ${business.businessId} обновлены`);
      } catch (error: any) {
        console.error(`[YandexMarketGo] Ошибка синхронизации остатков для бизнеса ${business.businessId}:`, error.message);
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
    console.error('[YandexMarketGo] Ошибка синхронизации остатков:', error);
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
        console.log(`[YandexMarketGo] Синхронизация цен для бизнеса ${business.businessId}`);

        // Загружаем все цены
        const prices = await yandexMarketGoService.getPrices(
          business.businessId,
          (current, total, stage) => {
            console.log(`[YandexMarketGo] ${business.businessId}: ${stage}`);
          }
        );

        // Создаем мапу для быстрого поиска
        const pricesMap = new Map<string, PriceItem>();
        prices.forEach((priceItem: any) => {
          pricesMap.set(priceItem.offerId, priceItem);
        });

        // Обновляем цены в связях
        const links = await YandexProductBusinessLink.find({ businessId: business.businessId });
        for (const link of links) {
          const priceItem = pricesMap.get(link.offerId);
          if (priceItem && priceItem.price) {
            link.price = parseFloat(priceItem.price.value) || 0;
            link.lastSync = new Date();
            await link.save();
            totalUpdated++;
          }
        }

        console.log(`[YandexMarketGo] Цены для бизнеса ${business.businessId} обновлены`);
      } catch (error: any) {
        console.error(`[YandexMarketGo] Ошибка синхронизации цен для бизнеса ${business.businessId}:`, error.message);
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
    console.error('[YandexMarketGo] Ошибка синхронизации цен:', error);
    res.status(500).json({ message: error.message || 'Ошибка синхронизации цен' });
  }
};

/**
 * Получить товар по артикулу со всеми бизнесами
 * Получает актуальные установленные цены из API
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

    if (links.length === 0) {
      return res.status(404).json({ message: 'Товар не найден ни в одном бизнесе' });
    }

    // Получаем информацию о бизнесах
    const businessIds = [...new Set(links.map(link => link.businessId))];
    const businesses = await YandexBusiness.find({ businessId: { $in: businessIds } });

    const businessMap = new Map(businesses.map(b => [b.businessId, b]));

    // Группируем offerIds по бизнесам для получения актуальных цен
    const businessOfferIds = new Map<string, string[]>();
    links.forEach(link => {
      if (!businessOfferIds.has(link.businessId)) {
        businessOfferIds.set(link.businessId, []);
      }
      businessOfferIds.get(link.businessId)!.push(link.offerId);
    });

    // Получаем актуальные установленные цены для каждого бизнеса
    const pricesByBusiness = new Map<string, Map<string, { value: number; currencyId: string }>>();
    
    for (const [businessId, offerIds] of businessOfferIds.entries()) {
      try {
        const pricesMap = await yandexMarketGoService.getOfferPrices(businessId, offerIds);
        pricesByBusiness.set(businessId, pricesMap);
      } catch (error: any) {
        console.warn(`[YandexMarketGo] Не удалось получить цены для бизнеса ${businessId}:`, error.message);
        // Продолжаем с сохраненными ценами из БД при ошибке
      }
    }

    // Формируем ответ с актуальными ценами
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
        const pricesMap = pricesByBusiness.get(link.businessId);
        const actualPrice = pricesMap?.get(link.offerId);
        
        return {
          businessId: link.businessId,
          businessName: business?.name || link.businessId,
          offerId: link.offerId,
          sku: link.sku,
          price: actualPrice?.value ?? link.price, // Используем актуальную цену из API, если доступна
          stock: link.stock,
          status: link.status,
          lastSync: link.lastSync,
        };
      }),
    };

    res.json(result);
  } catch (error: any) {
    console.error('[YandexMarketGo] Ошибка получения товара:', error);
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

        const updateResult = await yandexMarketGoService.updatePrices(businessId, updateOffers);

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
        console.error(`[YandexMarketGo] Ошибка обновления цены для бизнеса ${businessId}:`, error.message);
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
    console.error('[YandexMarketGo] Ошибка обновления цены:', error);
    res.status(500).json({ message: error.message || 'Ошибка обновления цены' });
  }
};

/**
 * Обновить название и описание товара
 */
export const updateProductName = async (req: AuthRequest, res: Response) => {
  try {
    const { vendorCode, name, description, language = 'ru' } = req.body;

    if (!vendorCode) {
      return res.status(400).json({ message: 'Артикул обязателен' });
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

    // Обновляем названия в каждом бизнесе
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

        // Обновляем каждый оффер
        for (const offer of offers) {
          const updateResult = await yandexMarketGoService.updateOfferMapping(
            businessId,
            offer.offerId,
            name,
            description,
            language
          );

          if (!updateResult.success) {
            results.push({
              businessId,
              businessName: business.name,
              success: false,
              error: updateResult.error,
            });
            continue;
          }
        }

        // Если все успешно, обновляем в БД
        if (name) product.name = name;
        if (description) product.description = description;
        await product.save();

        results.push({
          businessId,
          businessName: business.name,
          success: true,
        });
      } catch (error: any) {
        console.error(`[YandexMarketGo] Ошибка обновления названия для бизнеса ${businessId}:`, error.message);
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
    console.error('[YandexMarketGo] Ошибка обновления названия:', error);
    res.status(500).json({ message: error.message || 'Ошибка обновления названия' });
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
    console.error('[YandexMarketGo] Ошибка поиска товаров:', error);
    res.status(500).json({ message: error.message || 'Ошибка поиска товаров' });
  }
};

/**
 * Получить все товары с пагинацией
 * Поддерживает фильтрацию по businessId
 */
export const getAllProducts = async (req: AuthRequest, res: Response) => {
  try {
    const { page = 1, limit = 50, search, businessId } = req.query;
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

    // Если указан businessId, фильтруем товары по бизнесу
    let productIds: any[] = [];
    if (businessId && typeof businessId === 'string') {
      const links = await YandexProductBusinessLink.find({ businessId });
      productIds = links.map(link => link.productId);
      if (productIds.length === 0) {
        // Нет товаров для этого бизнеса
        return res.json({
          products: [],
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: 0,
            totalPages: 0,
          },
        });
      }
      query._id = { $in: productIds };
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
        const links = businessId 
          ? await YandexProductBusinessLink.find({ productId: product._id, businessId })
          : await YandexProductBusinessLink.find({ productId: product._id });
        
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
    console.error('[YandexMarketGo] Ошибка получения товаров:', error);
    res.status(500).json({ message: error.message || 'Ошибка получения товаров' });
  }
};

/**
 * Получить товары конкретного бизнеса
 */
export const getBusinessProducts = async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = req.params;
    const { page = 1, limit = 50, search } = req.query;
    const pageNum = parseInt(page.toString());
    const limitNum = Math.min(parseInt(limit.toString()), 100);
    const skip = (pageNum - 1) * limitNum;

    // Проверяем, что бизнес существует
    const business = await YandexBusiness.findOne({ businessId });
    if (!business) {
      return res.status(404).json({ message: 'Бизнес не найден' });
    }

    // Находим все связи товаров с этим бизнесом
    const linksQuery: any = { businessId };
    const links = await YandexProductBusinessLink.find(linksQuery);
    const productIds = links.map(link => link.productId);

    if (productIds.length === 0) {
      return res.json({
        products: [],
        business: {
          businessId: business.businessId,
          name: business.name,
        },
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: 0,
          totalPages: 0,
        },
      });
    }

    // Формируем запрос для товаров
    const query: any = { _id: { $in: productIds } };
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

    // Загружаем связи с бизнесами для каждого товара (только для текущего бизнеса)
    const productsWithBusinesses = await Promise.all(
      products.map(async (product) => {
        const link = await YandexProductBusinessLink.findOne({ 
          productId: product._id, 
          businessId 
        });

        if (!link) {
          return null;
        }

        return {
          id: product._id,
          vendorCode: product.vendorCode,
          name: product.name,
          description: product.description,
          images: product.images,
          category: product.category,
          business: {
            businessId: link.businessId,
            businessName: business.name,
            offerId: link.offerId,
            price: link.price,
            stock: link.stock,
            status: link.status,
          },
        };
      })
    );

    res.json({
      products: productsWithBusinesses.filter(p => p !== null),
      business: {
        businessId: business.businessId,
        name: business.name,
      },
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    console.error('[YandexMarketGo] Ошибка получения товаров бизнеса:', error);
    res.status(500).json({ message: error.message || 'Ошибка получения товаров бизнеса' });
  }
};

// Добавляем типы для TypeScript
interface StockItem {
  offerId: string;
  sku: number;
  items: Array<{
    type: string;
    count: number;
  }>;
}

interface PriceItem {
  offerId: string;
  price?: {
    value: string;
    currencyId: string;
  };
}

