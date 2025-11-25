import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import OzonConfig from '../models/OzonConfig';
import { OzonProduct } from '../models/OzonProduct';
import ozonService from '../services/ozonService';
import axios from 'axios';

export const getOzonConfig = async (req: AuthRequest, res: Response) => {
  try {
    const config = await OzonConfig.findOne();
    if (!config) {
      return res.json({
        clientId: '',
        apiKey: '',
        enabled: false,
      });
    }

    res.json({
      clientId: config.clientId,
      apiKey: config.apiKey || '',
      enabled: config.enabled,
    });
  } catch (error) {
    console.error('Get OZON config error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

export const updateOzonConfig = async (req: AuthRequest, res: Response) => {
  try {
    const { clientId, apiKey, enabled } = req.body;

    if (!clientId || !apiKey) {
      return res.status(400).json({ message: 'Client ID и API Key обязательны' });
    }

    let config = await OzonConfig.findOne();
    
    if (config) {
      config.clientId = clientId.trim();
      config.apiKey = apiKey.trim();
      config.enabled = enabled !== undefined ? enabled : config.enabled;
      await config.save();
    } else {
      config = new OzonConfig({
        clientId: clientId.trim(),
        apiKey: apiKey.trim(),
        enabled: enabled !== undefined ? enabled : false,
      });
      await config.save();
    }

    // Переинициализируем сервис
    await ozonService.initialize();

    res.json({
      message: 'Настройки OZON обновлены',
      clientId: config.clientId,
      apiKey: config.apiKey,
      enabled: config.enabled,
    });
  } catch (error: any) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Конфигурация уже существует' });
    }
    console.error('Update OZON config error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

export const getOzonProducts = async (req: AuthRequest, res: Response) => {
  try {
    const { lastId, limit, search, inStock, priceFrom, priceTo, forceRefresh } = req.query;
    const pageLimit = limit ? parseInt(limit as string) : 100;
    const skip = lastId ? parseInt(lastId as string) : 0;

    // Проверяем, нужно ли обновлять данные (если данные старше 1 часа или forceRefresh=true)
    // Для больших лимитов (загрузка всех товаров) всегда используем кеш
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const shouldRefresh = (forceRefresh === 'true' && pageLimit < 10000) || 
      (pageLimit < 10000 && (await OzonProduct.countDocuments({ syncedAt: { $gte: oneHourAgo } })) === 0);

    // Если данные свежие и не требуется принудительное обновление, загружаем из БД
    if (!shouldRefresh) {
      try {
        // Строим запрос к БД
        let query: any = {};
        
        // Поиск по тексту
        if (search) {
          query.$or = [
            { name: { $regex: search as string, $options: 'i' } },
            { offerId: { $regex: search as string, $options: 'i' } },
            { sku: { $regex: search as string, $options: 'i' } },
          ];
        }
        
        // Фильтр по наличию
        if (inStock !== undefined) {
          const inStockBool = inStock === 'true';
          query['stock.present'] = inStockBool ? { $gt: 0 } : 0;
        }
        
        // Фильтр по цене
        if (priceFrom || priceTo) {
          query.price = {};
          if (priceFrom) query.price.$gte = parseFloat(priceFrom as string);
          if (priceTo) query.price.$lte = parseFloat(priceTo as string);
        }
        
        // Получаем товары из БД - используем курсор для эффективной пагинации
        // Если запрашивается большой лимит (для загрузки всех товаров), используем другой подход
        let dbProducts: any[];
        let total: number;
        
        if (pageLimit >= 10000) {
          // Для больших лимитов загружаем все сразу без пагинации
          // Сортируем: сначала товары с остатками, потом по дате синхронизации, потом по имени
          // Ограничиваем максимальный размер ответа для предотвращения переполнения памяти
          const maxLimit = 50000; // Максимальное количество товаров за один запрос
          dbProducts = await OzonProduct.find(query)
            .sort({ hasStock: -1, syncedAt: -1, name: 1 })
            .limit(Math.min(pageLimit, maxLimit))
            .lean();
          total = await OzonProduct.countDocuments(query);
        } else {
          // Для обычной пагинации используем skip/limit
          // Сортируем: сначала товары с остатками, потом по дате синхронизации, потом по имени
          dbProducts = await OzonProduct.find(query)
            .sort({ hasStock: -1, syncedAt: -1, name: 1 })
            .skip(skip)
            .limit(pageLimit)
            .lean();
          total = await OzonProduct.countDocuments(query);
        }
        
        // Проверяем статистику остатков в БД
        const productsWithStock = await OzonProduct.countDocuments({ 'stock.present': { $gt: 0 } });
        const productsWithHasStock = await OzonProduct.countDocuments({ hasStock: true });
        const totalProducts = await OzonProduct.countDocuments({});
        console.log(`[DEBUG] Статистика БД: Всего товаров: ${totalProducts}, С остатками > 0: ${productsWithStock}, С hasStock=true: ${productsWithHasStock}`);
        
        // Находим несколько товаров с остатками для проверки
        const sampleWithStock = await OzonProduct.find({ 'stock.present': { $gt: 0 } })
          .limit(5)
          .lean();
        if (sampleWithStock.length > 0) {
          console.log(`[DEBUG] Примеры товаров с остатками из БД:`);
          sampleWithStock.forEach((p: any) => {
            console.log(`  - ${p.productId} (${p.name}): stock.present = ${p.stock?.present}, stock.reserved = ${p.stock?.reserved}, hasStock = ${p.hasStock}, syncedAt = ${p.syncedAt}`);
          });
        } else {
          // Если нет товаров с остатками, проверяем последние синхронизированные товары
          const recentProducts = await OzonProduct.find({})
            .sort({ syncedAt: -1 })
            .limit(5)
            .lean();
          console.log(`[DEBUG] Нет товаров с остатками. Проверяем последние синхронизированные товары:`);
          recentProducts.forEach((p: any) => {
            console.log(`  - ${p.productId} (${p.name}): stock = ${JSON.stringify(p.stock)}, hasStock = ${p.hasStock}, syncedAt = ${p.syncedAt}`);
          });
        }
        
        // Логируем первые 5 товаров из запроса для отладки
        console.log(`[DEBUG] Первые 5 товаров из запроса (после сортировки):`);
        dbProducts.slice(0, 5).forEach((p: any) => {
          console.log(`  - ${p.productId} (${p.name}): hasStock=${p.hasStock}, stock.present=${p.stock?.present}, stock.reserved=${p.stock?.reserved}, syncedAt=${p.syncedAt}`);
        });
        
        // ПРОВЕРКА: Загружаем товары с остатками напрямую из БД
        const testProductsWithStock = await OzonProduct.find({ 'stock.present': { $gt: 0 } })
          .limit(5)
          .lean();
        console.log(`[DEBUG] ПРОВЕРКА: Товары с остатками > 0 напрямую из БД (${testProductsWithStock.length}):`);
        testProductsWithStock.forEach((p: any) => {
          console.log(`  - ${p.productId} (${p.name}): stock=${JSON.stringify(p.stock)}, hasStock=${p.hasStock}, syncedAt=${p.syncedAt}`);
        });
        
        // Преобразуем в формат для фронтенда
        const products = dbProducts.map((p: any) => {
          // Логируем первые несколько товаров для отладки
          if (dbProducts.indexOf(p) < 3) {
            console.log(`[DEBUG] Загрузка товара из БД ${p.productId}:`, {
              name: p.name,
              price: p.price,
              stock: p.stock,
              stockType: typeof p.stock,
              stockKeys: p.stock ? Object.keys(p.stock) : null,
              stockPresent: p.stock?.present,
              stockPresentType: typeof p.stock?.present,
              hasStock: p.hasStock,
              primaryImage: p.primaryImage,
              imagesCount: p.images?.length || 0,
              syncedAt: p.syncedAt
            });
          }
          
          // Правильно обрабатываем stock - может быть объектом или вложенными полями
          let stockData = { coming: 0, present: 0, reserved: 0 };
          if (p.stock) {
            if (typeof p.stock === 'object' && !Array.isArray(p.stock)) {
              // Используем ?? вместо || чтобы не потерять значение 0
              stockData = {
                coming: p.stock.coming ?? 0,
                present: p.stock.present ?? 0,
                reserved: p.stock.reserved ?? 0,
              };
            }
          }
          
          // Логируем для первых товаров, если остатки не загрузились
          if (dbProducts.indexOf(p) < 3 && stockData.present === 0 && p.hasStock) {
            console.log(`[DEBUG] ВНИМАНИЕ: Товар ${p.productId} имеет hasStock=true, но stock.present=0:`, {
              stock: p.stock,
              stockType: typeof p.stock,
              hasStock: p.hasStock,
              stockPresent: p.stock?.present,
              stockPresentType: typeof p.stock?.present,
              stockKeys: p.stock ? Object.keys(p.stock) : null,
              fullStock: JSON.stringify(p.stock)
            });
          }
          
          // Логируем для первых товаров с остатками
          if (dbProducts.indexOf(p) < 3 && stockData.present > 0) {
            console.log(`[DEBUG] Товар ${p.productId} загружен с остатком ${stockData.present}:`, {
              stock: p.stock,
              stockData,
              hasStock: p.hasStock
            });
          }
          
          // Вычисляем полный остаток (present + reserved)
          const totalStock = (stockData.present ?? 0) + (stockData.reserved ?? 0);
          
          return {
            productId: p.productId,
            offerId: p.offerId,
            name: p.name || '',
            sku: p.sku,
            price: p.price || 0,
            oldPrice: p.oldPrice || null,
            currency: p.currency || 'RUB',
            status: p.status || '',
            images: p.images || [],
            primaryImage: p.primaryImage || null,
            stock: {
              ...stockData,
              total: totalStock, // Добавляем поле total для удобства
            },
            hasPrice: p.hasPrice || false,
            hasStock: p.hasStock || false,
            createdAt: p.createdAtOzon || '',
            updatedAt: p.updatedAtOzon || '',
          };
        });
        
        return res.json({
          products,
          total,
          lastId: skip + products.length < total ? (skip + products.length).toString() : undefined,
          fromCache: true,
        });
      } catch (dbError: any) {
        console.error('Error loading from DB, falling back to API:', dbError.message);
        console.error('DB Error stack:', dbError.stack);
        // Продолжаем загрузку через API
      }
    }

    // Загружаем через API (если данные устарели или ошибка БД)
    await ozonService.initialize();
    
    // Получаем список товаров через v3/product/list
    const listResponse = await ozonService.getProducts(
      lastId as string | undefined,
      pageLimit
    );

    // Проверяем, что есть товары
    if (!listResponse || !listResponse.result || !listResponse.result.items || listResponse.result.items.length === 0) {
      return res.json({
        products: [],
        total: 0,
        lastId: undefined,
      });
    }

    // Получаем полную информацию о товарах - делаем запросы параллельно для ускорения
    const productIds = listResponse.result.items
      .map(item => item.product_id)
      .filter(id => id !== undefined && id !== null);
    
    const productIdStrings = productIds.map(id => id.toString());
    const offerIds = listResponse.result.items
      .map((item: any) => item.offer_id)
      .filter((id: any) => id !== undefined && id !== null && id !== '');
    const skuList = listResponse.result.items
      .map(item => item.sku)
      .filter(sku => sku !== undefined && sku !== null)
      .map(sku => sku.toString());
    
    let attributesResponse: any = { result: [] };
    let picturesResponse: any = { items: [] };
    let stocksResponse: any = { result: [] };
    let pricesResponse: any = { result: [] };

    if (productIds.length > 0) {
      // Параллельно получаем атрибуты, картинки и остатки
      const [attributesResult, picturesResult, stocksResult, pricesResult] = await Promise.allSettled([
        // Атрибуты
        ozonService.getProductAttributes(
          { product_id: productIds },
          undefined,
          Math.min(productIds.length, 1000)
        ).catch((error: any) => {
          if (!error.message?.includes('rate limit')) {
            console.error('Error fetching attributes:', error.message);
          }
          return { result: [] };
        }),
        
        // Картинки
        ozonService.getProductPictures(productIdStrings).catch((error: any) => {
          if (!error.message?.includes('rate limit')) {
            console.error('Error fetching pictures:', error.message);
          }
          return { items: [] };
        }),
        
        // Остатки - используем /v4/product/info/stocks с offer_id
        (async () => {
          if (offerIds.length === 0) return { items: [] };
          try {
            // Используем новый метод /v4/product/info/stocks с фильтром по offer_id
            // Разбиваем на батчи по 1000 offer_id (лимит API)
            const stocksPromises = [];
            for (let i = 0; i < offerIds.length; i += 1000) {
              const batch = offerIds.slice(i, i + 1000);
              stocksPromises.push(
                ozonService.getProductStocks(
                  { offer_id: batch },
                  1000
                ).catch(err => {
                  if (!err.message?.includes('rate limit')) {
                    console.error(`Error fetching stocks for batch ${i}:`, err.message);
                  }
                  return { items: [] };
                })
              );
            }
            const stocksResults = await Promise.all(stocksPromises);
            // Преобразуем формат данных для совместимости
            const allStocks: any[] = [];
            stocksResults.forEach((result: any) => {
              if (result.items && Array.isArray(result.items)) {
                result.items.forEach((item: any) => {
                  if (item.items && Array.isArray(item.items)) {
                    item.items.forEach((warehouseItem: any) => {
                      allStocks.push({
                        ...warehouseItem,
                        offer_id: item.offer_id,
                        product_id: item.product_id,
                        sku: warehouseItem.sku,
                      });
                    });
                  }
                });
              }
            });
            return { result: allStocks };
          } catch (error: any) {
            console.error('Error fetching stocks:', error.message);
            return { result: [] };
          }
        })(),
        
        // Цены - разбиваем на батчи
        (async () => {
          try {
            const pricesResults = [];
            const batchSize = 1000;
            
            // Сначала пробуем получить по product_id
            for (let i = 0; i < productIdStrings.length; i += batchSize) {
              const batchProductIds = productIdStrings.slice(i, i + batchSize);
              
              try {
                const batchResponse = await ozonService.getProductInfoList(
                  batchProductIds,
                  undefined,
                  undefined
                );
                
                if (batchResponse.items && Array.isArray(batchResponse.items)) {
                  pricesResults.push(...batchResponse.items);
                }
                
                // Небольшая задержка между батчами
                if (i + batchSize < productIdStrings.length) {
                  await new Promise(resolve => setTimeout(resolve, 200));
                }
              } catch (error: any) {
                // Если не получилось по product_id, пробуем по offer_id для этого батча
                if (error.message?.includes('use either')) {
                  const batchOfferIds = offerIds.slice(i, i + batchSize);
                  if (batchOfferIds.length > 0) {
                    try {
                      const batchResponse = await ozonService.getProductInfoList(
                        undefined,
                        batchOfferIds,
                        undefined
                      );
                      
                      if (batchResponse.items && Array.isArray(batchResponse.items)) {
                        pricesResults.push(...batchResponse.items);
                      }
                    } catch (error2: any) {
                      if (!error2.message?.includes('rate limit')) {
                        console.error(`Error fetching prices for batch ${i} (by offer_id):`, error2.message);
                      }
                    }
                  }
                } else if (!error.message?.includes('rate limit')) {
                  console.error(`Error fetching prices for batch ${i}:`, error.message);
                }
              }
            }
            
            return { result: pricesResults };
          } catch (error: any) {
            console.error('Error fetching prices:', error.message);
            return { result: [] };
          }
        })()
      ]);

      // Обрабатываем результаты
      if (attributesResult.status === 'fulfilled') {
        attributesResponse = attributesResult.value;
      }
      if (picturesResult.status === 'fulfilled') {
        picturesResponse = picturesResult.value;
      }
      if (stocksResult.status === 'fulfilled') {
        stocksResponse = stocksResult.value;
      }
      if (pricesResult.status === 'fulfilled') {
        pricesResponse = pricesResult.value;
      }
    }

    // Создаем мапы для быстрого поиска
    const attributesMap = new Map();
    if (attributesResponse.result && Array.isArray(attributesResponse.result)) {
      attributesResponse.result.forEach((item: any) => {
        attributesMap.set(item.id?.toString(), item);
      });
    }

    const picturesMap = new Map();
    if (picturesResponse.items && Array.isArray(picturesResponse.items)) {
      picturesResponse.items.forEach((item: any) => {
        picturesMap.set(item.product_id?.toString(), item);
      });
    }

    const pricesMap = new Map();
    // Обрабатываем результат из /v3/product/info/list (items) или /v2/product/info (result)
    const pricesItems = pricesResponse.items || pricesResponse.result || [];
    if (Array.isArray(pricesItems)) {
      pricesItems.forEach((item: any) => {
        // Для /v3/product/info/list используется id вместо product_id
        const productId = item.id?.toString() || item.product_id?.toString();
        const offerId = item.offer_id?.toString();
        const sku = item.sku?.toString();
        
        if (productId) {
          pricesMap.set(productId, item);
        }
        if (offerId) {
          pricesMap.set(offerId, item);
        }
        if (sku) {
          pricesMap.set(sku, item);
        }
      });
    }

    const stocksMap = new Map();
    if (stocksResponse.result && Array.isArray(stocksResponse.result)) {
      stocksResponse.result.forEach((item: any) => {
        // /v4/product/info/stocks возвращает объекты с полями: offer_id, product_id, sku, available, reserved
        // Сохраняем по обоим ключам (offer_id и sku) для надежности
        const offerKey = item.offer_id?.toString();
        const skuKey = item.sku?.toString();
        
        if (offerKey) {
          if (!stocksMap.has(offerKey)) {
            stocksMap.set(offerKey, []);
          }
          stocksMap.get(offerKey)!.push(item);
        }
        
        if (skuKey && skuKey !== offerKey) {
          if (!stocksMap.has(skuKey)) {
            stocksMap.set(skuKey, []);
          }
          stocksMap.get(skuKey)!.push(item);
        }
      });
    }

    // Форматируем данные для фронтенда
    let products = listResponse.result.items.map((item) => {
      const productId = item.product_id?.toString();
      const sku = item.sku?.toString();
      const offerId = item.offer_id?.toString();
      
      const attributes = productId ? attributesMap.get(productId) : null;
      const pictures = productId ? picturesMap.get(productId) : null;
      const priceInfo = productId ? pricesMap.get(productId) : 
                       (offerId ? pricesMap.get(offerId) : 
                       (sku ? pricesMap.get(sku) : null));
      // Получаем остатки - пробуем по SKU, затем по offer_id
      const stockItems = sku ? (stocksMap.get(sku) || []) : 
                        (offerId ? (stocksMap.get(offerId) || []) : []);

      // Суммируем остатки по всем складам
      let totalPresent = 0;
      let totalReserved = 0;
      if (stockItems && Array.isArray(stockItems) && stockItems.length > 0) {
        stockItems.forEach((stockItem: any) => {
          // present и reserved могут быть числами или строками
          const present = typeof stockItem.present === 'number' ? stockItem.present : parseInt(stockItem.present) || 0;
          const reserved = typeof stockItem.reserved === 'number' ? stockItem.reserved : parseInt(stockItem.reserved) || 0;
          totalPresent += present;
          totalReserved += reserved;
        });
      }

      // Используем данные из attributes если доступны, иначе из list
      const name = attributes?.name || item.name;
      const images = pictures?.photo || pictures?.primary_photo || attributes?.images || item.images || [];
      const primaryImage = pictures?.primary_photo?.[0] || images[0] || attributes?.primary_image || item.primary_image || null;

      // Получаем цены из priceInfo или из item
      let price = 0;
      let oldPrice = null;
      let currency = item.currency_code || 'RUB';

      if (priceInfo) {
        // Цены из /v3/product/info/list или /v2/product/info
        price = parseFloat(priceInfo.price) || parseFloat(priceInfo.marketing_price) || 0;
        oldPrice = parseFloat(priceInfo.old_price) || null;
        currency = priceInfo.currency_code || currency;
      } else if (item.price) {
        // Цены из /v3/product/list (если есть)
        price = parseFloat(item.price) || 0;
        oldPrice = parseFloat(item.old_price) || null;
      }

      return {
        productId: item.product_id,
        offerId: item.offer_id,
        name: name,
        sku: item.sku,
        price: price,
        oldPrice: oldPrice,
        currency: currency,
        status: item.status,
        images: images,
        primaryImage: primaryImage,
        stock: {
          coming: item.stocks?.coming || 0,
          present: totalPresent || item.stocks?.present || 0,
          reserved: totalReserved || item.stocks?.reserved || 0,
        },
        hasPrice: price > 0 || item.visibility_details?.has_price || false,
        hasStock: (totalPresent > 0) || item.visibility_details?.has_stock || false,
        createdAtOzon: item.created_at || '',
        updatedAtOzon: item.updated_at || '',
      };
    });

    // Применяем фильтры
    if (search) {
      const searchLower = (search as string).toLowerCase();
      products = products.filter(p => 
        p.name.toLowerCase().includes(searchLower) ||
        p.offerId.toLowerCase().includes(searchLower) ||
        p.sku.toString().includes(searchLower)
      );
    }

    if (inStock !== undefined) {
      const inStockBool = inStock === 'true';
      products = products.filter(p => inStockBool ? p.stock.present > 0 : p.stock.present === 0);
    }

    if (priceFrom) {
      products = products.filter(p => p.price >= parseFloat(priceFrom as string));
    }

    if (priceTo) {
      products = products.filter(p => p.price <= parseFloat(priceTo as string));
    }

    // Сохраняем товары в БД (в фоне, не блокируем ответ)
    if (products.length > 0) {
      OzonProduct.bulkWrite(
        products.map((product) => ({
          updateOne: {
            filter: { productId: product.productId },
            update: {
              $set: {
                ...product,
                syncedAt: new Date(),
              },
            },
            upsert: true,
          },
        })),
        { ordered: false }
      ).catch((err) => {
        console.error('Error saving products to DB:', err.message);
      });
    }

    res.json({
      products,
      total: products.length,
      lastId: listResponse.result.last_id,
      fromCache: false,
    });
  } catch (error: any) {
    console.error('Get OZON products error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      code: error.code,
      response: error.response?.data
    });
    res.status(500).json({ 
      message: error.message || 'Ошибка при получении товаров OZON',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

export const testOzonConnection = async (req: AuthRequest, res: Response) => {
  try {
    const { clientId, apiKey } = req.body;

    if (!clientId || !apiKey) {
      return res.status(400).json({ 
        success: false,
        message: 'Client ID и API Key обязательны' 
      });
    }

    // Тестируем подключение напрямую, без сохранения в БД
    const testClient = axios.create({
      baseURL: 'https://api-seller.ozon.ru',
      headers: {
        'Client-Id': clientId.trim(),
        'Api-Key': apiKey.trim(),
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    // Пытаемся получить список товаров (только 1 товар для теста)
    // Используем v3 API согласно документации
    const response = await testClient.post('/v3/product/list', {
      filter: {},
      limit: 1,
    });

    if (response.data && response.data.result) {
      res.json({ 
        success: true,
        message: 'Подключение к OZON API успешно',
        totalProducts: response.data.result.total || 0,
      });
    } else {
      throw new Error('Неверный формат ответа от OZON API');
    }
  } catch (error: any) {
    console.error('Test OZON connection error:', error.response?.data || error.message);
    res.status(400).json({ 
      success: false,
      message: error.response?.data?.message || error.message || 'Ошибка подключения к OZON API' 
    });
  }
};

export const getOzonProductAttributes = async (req: AuthRequest, res: Response) => {
  try {
    const { filter, lastId, limit, sortBy, sortDir } = req.body;

    await ozonService.initialize();
    const response = await ozonService.getProductAttributes(
      filter,
      lastId,
      limit ? parseInt(limit) : 100,
      sortBy || 'id',
      sortDir || 'asc'
    );

    res.json(response);
  } catch (error: any) {
    console.error('Get OZON product attributes error:', error);
    res.status(500).json({ 
      message: error.message || 'Ошибка при получении характеристик товаров OZON' 
    });
  }
};

export const getOzonProductPictures = async (req: AuthRequest, res: Response) => {
  try {
    const { productIds } = req.body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ message: 'Список идентификаторов товаров обязателен' });
    }

    await ozonService.initialize();
    const response = await ozonService.getProductPictures(productIds);

    res.json(response);
  } catch (error: any) {
    console.error('Get OZON product pictures error:', error);
    res.status(500).json({ 
      message: error.message || 'Ошибка при получении изображений товаров OZON' 
    });
  }
};

export const getOzonStocksByWarehouse = async (req: AuthRequest, res: Response) => {
  try {
    const { sku, offer_id } = req.body;

    if ((!sku || !Array.isArray(sku) || sku.length === 0) && 
        (!offer_id || !Array.isArray(offer_id) || offer_id.length === 0)) {
      return res.status(400).json({ 
        message: 'Необходимо указать либо sku, либо offer_id (массив идентификаторов)' 
      });
    }

    await ozonService.initialize();
    const response = await ozonService.getStocksByWarehouse(sku, offer_id);

    res.json(response);
  } catch (error: any) {
    console.error('Get OZON stocks by warehouse error:', error);
    res.status(500).json({ 
      message: error.message || 'Ошибка при получении остатков на складах OZON' 
    });
  }
};

export const updateOzonPrices = async (req: AuthRequest, res: Response) => {
  try {
    const { prices } = req.body;

    if (!prices || !Array.isArray(prices) || prices.length === 0) {
      return res.status(400).json({ message: 'Список цен обязателен' });
    }

    await ozonService.initialize();
    const response = await ozonService.updatePrices(prices);

    res.json(response);
  } catch (error: any) {
    console.error('Update OZON prices error:', error);
    res.status(500).json({ 
      message: error.message || 'Ошибка при обновлении цен OZON' 
    });
  }
};

export const getOzonChats = async (req: AuthRequest, res: Response) => {
  try {
    const { filter, limit, cursor } = req.body;

    await ozonService.initialize();
    const response = await ozonService.getChats(
      filter,
      limit ? parseInt(limit) : 30,
      cursor
    );

    res.json(response);
  } catch (error: any) {
    console.error('Get OZON chats error:', error);
    res.status(500).json({ 
      message: error.message || 'Ошибка при получении чатов OZON' 
    });
  }
};

export const getOzonChatHistory = async (req: AuthRequest, res: Response) => {
  try {
    const { chatId, limit, direction, fromMessageId } = req.body;

    if (!chatId) {
      return res.status(400).json({ message: 'ID чата обязателен' });
    }

    await ozonService.initialize();
    const response = await ozonService.getChatHistory(
      chatId,
      limit ? parseInt(limit) : 50,
      direction || 'Backward',
      fromMessageId
    );

    res.json(response);
  } catch (error: any) {
    console.error('Get OZON chat history error:', error);
    res.status(500).json({ 
      message: error.message || 'Ошибка при получении истории чата OZON' 
    });
  }
};

export const sendFileToOzonChat = async (req: AuthRequest, res: Response) => {
  try {
    const { chatId, base64Content, fileName } = req.body;

    if (!chatId || !base64Content || !fileName) {
      return res.status(400).json({ 
        message: 'ID чата, содержимое файла (base64) и имя файла обязательны' 
      });
    }

    await ozonService.initialize();
    const response = await ozonService.sendFileToChat(chatId, base64Content, fileName);

    res.json(response);
  } catch (error: any) {
    console.error('Send file to OZON chat error:', error);
    res.status(500).json({ 
      message: error.message || 'Ошибка при отправке файла в чат OZON' 
    });
  }
};

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
    duration: number;
  };
  error?: string;
} | null = null;

export const syncOzonProducts = async (req: AuthRequest, res: Response) => {
  try {
    // Проверяем, настроен ли OZON API
    const config = await OzonConfig.findOne();
    if (!config || !config.enabled || !config.clientId || !config.apiKey) {
      return res.status(400).json({ message: 'OZON API не настроен. Пожалуйста, настройте API в разделе Настройки' });
    }

    // Инициализируем сервис
    await ozonService.initialize();

    // Сбрасываем прогресс
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

    // Запускаем синхронизацию асинхронно
    ozonService.syncAllProducts((current, total, stage) => {
      if (syncProgressState) {
        syncProgressState.current = current;
        syncProgressState.total = total;
        syncProgressState.stage = stage;
      }
      console.log(`[OZON Sync] ${stage} - ${current}/${total}`);
    })
      .then((result) => {
        if (syncProgressState) {
          syncProgressState.status = 'completed';
          syncProgressState.result = result;
          syncProgressState.current = result.synced;
          syncProgressState.total = result.total;
        }
        console.log(`[OZON Sync] Завершено: ${result.synced}/${result.total} товаров за ${result.duration}с. Ошибок: ${result.errors}`);
      })
      .catch((error) => {
        if (syncProgressState) {
          syncProgressState.status = 'error';
          syncProgressState.error = error.message || 'Ошибка синхронизации';
        }
        console.error('[OZON Sync] Ошибка синхронизации:', error);
      });
  } catch (error: any) {
    console.error('Sync OZON products error:', error);
    if (syncProgressState) {
      syncProgressState.status = 'error';
      syncProgressState.error = error.message || 'Ошибка при запуске синхронизации';
    }
    if (!res.headersSent) {
      res.status(500).json({
        message: error.message || 'Ошибка при запуске синхронизации товаров OZON'
      });
    }
  }
};

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
    console.error('Get sync progress error:', error);
    res.status(500).json({
      message: error.message || 'Ошибка при получении прогресса синхронизации'
    });
  }
};

export const getOzonProductInfo = async (req: AuthRequest, res: Response) => {
  try {
    const { productId, offerId, sku } = req.query;

    if (!productId && !offerId && !sku) {
      return res.status(400).json({ 
        message: 'Необходимо указать product_id, offer_id или sku' 
      });
    }

    await ozonService.initialize();
    const response = await ozonService.getProductInfo(
      productId ? parseInt(productId as string) : undefined,
      offerId as string | undefined,
      sku ? parseInt(sku as string) : undefined
    );

    res.json(response);
  } catch (error: any) {
    console.error('Get OZON product info error:', error);
    res.status(500).json({ 
      message: error.message || 'Ошибка при получении информации о товаре OZON' 
    });
  }
};

export const getOzonProductInfoBatch = async (req: AuthRequest, res: Response) => {
  try {
    const { productIds, offerIds, skus } = req.body;

    if ((!productIds || productIds.length === 0) && 
        (!offerIds || offerIds.length === 0) && 
        (!skus || skus.length === 0)) {
      return res.status(400).json({ 
        message: 'Необходимо указать хотя бы один product_id, offer_id или sku' 
      });
    }

    await ozonService.initialize();
    const response = await ozonService.getProductInfoBatch(
      productIds,
      offerIds,
      skus
    );

    res.json(response);
  } catch (error: any) {
    console.error('Get OZON product info batch error:', error);
    res.status(500).json({ 
      message: error.message || 'Ошибка при получении информации о товарах OZON' 
    });
  }
};

export const getOzonProductStocks = async (req: AuthRequest, res: Response) => {
  try {
    const { filter, limit, cursor } = req.body;

    if (!filter) {
      return res.status(400).json({ message: 'Фильтр обязателен' });
    }

    await ozonService.initialize();
    const response = await ozonService.getProductStocks(
      filter,
      limit ? parseInt(limit) : 100,
      cursor
    );

    res.json(response);
  } catch (error: any) {
    console.error('Get OZON product stocks error:', error);
    res.status(500).json({ 
      message: error.message || 'Ошибка при получении остатков товаров OZON' 
    });
  }
};

export const getOzonWarehouseStocks = async (req: AuthRequest, res: Response) => {
  try {
    const { warehouseId, limit, cursor } = req.body;

    if (!warehouseId) {
      return res.status(400).json({ message: 'ID склада обязателен' });
    }

    await ozonService.initialize();
    const response = await ozonService.getWarehouseStocks(
      parseInt(warehouseId),
      limit ? parseInt(limit) : 100,
      cursor
    );

    res.json(response);
  } catch (error: any) {
    console.error('Get OZON warehouse stocks error:', error);
    res.status(500).json({ 
      message: error.message || 'Ошибка при получении остатков на складе OZON' 
    });
  }
};

export const updateOzonPriceTimer = async (req: AuthRequest, res: Response) => {
  try {
    const { productIds } = req.body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ message: 'Список product_id обязателен' });
    }

    await ozonService.initialize();
    const response = await ozonService.updatePriceTimer(productIds);

    res.json(response);
  } catch (error: any) {
    console.error('Update OZON price timer error:', error);
    res.status(500).json({ 
      message: error.message || 'Ошибка при обновлении таймера минимальной цены OZON' 
    });
  }
};

export const sendOzonChatMessage = async (req: AuthRequest, res: Response) => {
  try {
    const { chatId, text } = req.body;

    if (!chatId || !text) {
      return res.status(400).json({ 
        message: 'ID чата и текст сообщения обязательны' 
      });
    }

    await ozonService.initialize();
    const response = await ozonService.sendChatMessage(chatId, text);

    res.json(response);
  } catch (error: any) {
    console.error('Send OZON chat message error:', error);
    res.status(500).json({ 
      message: error.message || 'Ошибка при отправке сообщения в чат OZON' 
    });
  }
};

export const startOzonChat = async (req: AuthRequest, res: Response) => {
  try {
    const { postingNumber } = req.body;

    if (!postingNumber) {
      return res.status(400).json({ 
        message: 'Номер отправления обязателен' 
      });
    }

    await ozonService.initialize();
    const response = await ozonService.startChat(postingNumber);

    res.json(response);
  } catch (error: any) {
    console.error('Start OZON chat error:', error);
    res.status(500).json({ 
      message: error.message || 'Ошибка при создании чата OZON' 
    });
  }
};

export const markOzonChatAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const { chatId, fromMessageId } = req.body;

    if (!chatId) {
      return res.status(400).json({ 
        message: 'ID чата обязателен' 
      });
    }

    await ozonService.initialize();
    const response = await ozonService.markChatAsRead(chatId, fromMessageId);

    res.json(response);
  } catch (error: any) {
    console.error('Mark OZON chat as read error:', error);
    res.status(500).json({ 
      message: error.message || 'Ошибка при отметке сообщений как прочитанных' 
    });
  }
};

export const getOzonAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    const { dateFrom, dateTo, metrics, dimension, filters, limit, offset, sort } = req.body;

    if (!dateFrom || !dateTo || !metrics || !dimension) {
      return res.status(400).json({ 
        message: 'dateFrom, dateTo, metrics и dimension обязательны' 
      });
    }

    await ozonService.initialize();
    const response = await ozonService.getAnalyticsData(
      dateFrom,
      dateTo,
      metrics,
      dimension,
      filters || [],
      limit || 1000,
      offset || 0,
      sort || []
    );

    res.json(response);
  } catch (error: any) {
    console.error('Get OZON analytics error:', error);
    
    // Проверяем, является ли это ошибкой отсутствия прав
    if (error.message?.includes('missing a required role') || 
        error.message?.includes('Api-Key is missing')) {
      return res.status(403).json({ 
        message: 'Аналитика доступна только для продавцов с подпиской Premium Plus или Premium Pro. Обновите подписку в личном кабинете OZON.' 
      });
    }
    
    res.status(500).json({ 
      message: error.message || 'Ошибка при получении аналитики OZON' 
    });
  }
};

export const getOzonProductQueries = async (req: AuthRequest, res: Response) => {
  try {
    const { dateFrom, dateTo, skus, pageSize, page, sortBy, sortDir } = req.body;

    if (!dateFrom || !skus || !Array.isArray(skus) || skus.length === 0) {
      return res.status(400).json({ 
        message: 'dateFrom и массив skus обязательны' 
      });
    }

    await ozonService.initialize();
    const response = await ozonService.getProductQueries(
      dateFrom,
      skus,
      pageSize || 1000,
      page || 0,
      dateTo,
      sortBy || 'BY_SEARCHES',
      sortDir || 'DESCENDING'
    );

    res.json(response);
  } catch (error: any) {
    console.error('Get OZON product queries error:', error);
    res.status(500).json({ 
      message: error.message || 'Ошибка при получении запросов товаров OZON' 
    });
  }
};

export const getOzonProductQueriesDetails = async (req: AuthRequest, res: Response) => {
  try {
    const { dateFrom, dateTo, skus, limitBySku, pageSize, page, sortBy, sortDir } = req.body;

    if (!dateFrom || !skus || !Array.isArray(skus) || skus.length === 0 || !limitBySku) {
      return res.status(400).json({ 
        message: 'dateFrom, массив skus и limitBySku обязательны' 
      });
    }

    await ozonService.initialize();
    const response = await ozonService.getProductQueriesDetails(
      dateFrom,
      skus,
      limitBySku,
      pageSize || 100,
      page || 0,
      dateTo,
      sortBy || 'BY_SEARCHES',
      sortDir || 'DESCENDING'
    );

    res.json(response);
  } catch (error: any) {
    console.error('Get OZON product queries details error:', error);
    res.status(500).json({ 
      message: error.message || 'Ошибка при получении детализации запросов товаров OZON' 
    });
  }
};

export const getOzonRealizationByDay = async (req: AuthRequest, res: Response) => {
  try {
    const { day, month, year } = req.body;

    if (day === undefined || month === undefined || year === undefined) {
      return res.status(400).json({ 
        message: 'День, месяц и год обязательны' 
      });
    }

    await ozonService.initialize();
    const response = await ozonService.getRealizationByDay(
      parseInt(day),
      parseInt(month),
      parseInt(year)
    );

    res.json(response);
  } catch (error: any) {
    console.error('Get OZON realization by day error:', error);
    
    // Проверяем, является ли это ошибкой отсутствия прав
    if (error.message?.includes('missing a required role') || 
        error.message?.includes('Api-Key is missing')) {
      return res.status(403).json({ 
        message: 'Этот метод доступен только для продавцов с подпиской Premium Plus или Premium Pro. Обновите подписку в личном кабинете OZON.' 
      });
    }
    
    res.status(500).json({ 
      message: error.message || 'Ошибка при получении отчёта о реализации OZON' 
    });
  }
};

export const searchOzonQueriesByText = async (req: AuthRequest, res: Response) => {
  try {
    const { text, limit, offset, sortBy, sortDir } = req.body;

    if (!text) {
      return res.status(400).json({ 
        message: 'Текст поиска обязателен' 
      });
    }

    await ozonService.initialize();
    const response = await ozonService.searchQueriesByText(
      text,
      limit || 50,
      offset || 0,
      sortBy || 'SORT_BY_UNSPECIFIED',
      sortDir || 'SORT_DIR_UNSPECIFIED'
    );

    res.json(response);
  } catch (error: any) {
    console.error('Search OZON queries by text error:', error);
    res.status(500).json({ 
      message: error.message || 'Ошибка при поиске запросов OZON' 
    });
  }
};

export const getOzonTopSearchQueries = async (req: AuthRequest, res: Response) => {
  try {
    const { limit, offset } = req.query;

    await ozonService.initialize();
    const response = await ozonService.getTopSearchQueries(
      limit ? parseInt(limit as string) : 50,
      offset ? parseInt(offset as string) : 0
    );

    res.json(response);
  } catch (error: any) {
    console.error('Get OZON top search queries error:', error);
    res.status(500).json({ 
      message: error.message || 'Ошибка при получении популярных запросов OZON' 
    });
  }
};

// Export all OZON controller functions

