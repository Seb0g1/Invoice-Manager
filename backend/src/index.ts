import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';
import routes from './routes';
import User from './models/User';
import bcrypt from 'bcrypt';
import OzonConfig from './models/OzonConfig';
import axios from 'axios';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/api', routes);

// Подключение к MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/invoice-db')
  .then(() => {
    console.log('✅ Подключено к MongoDB');
    seedData();
  })
  .catch((error) => {
    console.error('❌ Ошибка подключения к MongoDB:', error);
  });

// Сиды данных - создание дефолтных пользователей
async function seedData() {
  try {
    const directorExists = await User.findOne({ login: 'director' });
    if (!directorExists) {
      const directorPassword = await bcrypt.hash('12345', 10);
      await User.create({
        login: 'director',
        password: directorPassword,
        role: 'director'
      });
      console.log('✅ Создан пользователь: director / 12345');
    }

    const collectorExists = await User.findOne({ login: 'collector1' });
    if (!collectorExists) {
      const collectorPassword = await bcrypt.hash('12345', 10);
      await User.create({
        login: 'collector1',
        password: collectorPassword,
        role: 'collector'
      });
      console.log('✅ Создан пользователь: collector1 / 12345');
    }
  } catch (error) {
    console.error('Ошибка при создании дефолтных пользователей:', error);
  }
}

// Функция синхронизации товаров OZON
async function syncOzonProducts() {
  try {
    const config = await OzonConfig.findOne({ enabled: true });
    if (!config || !config.clientId || !config.apiKey) {
      return;
    }

    console.log('🔄 Начало автоматической синхронизации товаров OZON...');
    
    const { OzonProduct } = await import('./models/OzonProduct');
    
    const client = axios.create({
      baseURL: 'https://api-seller.ozon.ru',
      headers: {
        'Client-Id': config.clientId,
        'Api-Key': config.apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    let lastId: string | undefined = undefined;
    let totalSynced = 0;
    let hasMore = true;

    while (hasMore) {
      try {
        const response: any = await client.post('/v3/product/list', {
          filter: {},
          limit: 1000,
          ...(lastId && { last_id: lastId }),
        });

        const items = response.data.result?.items || [];
        lastId = response.data.result?.last_id;
        totalSynced += items.length;
        hasMore = !!lastId && items.length > 0;

        // Сохраняем базовую информацию в БД
        if (items.length > 0) {
          // Получаем остатки для всех товаров через /v4/product/info/stocks
          const offerIdList = items
            .map((item: any) => item.offer_id)
            .filter((offerId: any) => offerId !== undefined && offerId !== null && offerId !== '');
          
          let stocksMap = new Map();
          if (offerIdList.length > 0) {
            try {
              // Используем новый метод /v4/product/info/stocks с фильтром по offer_id
              // Разбиваем на батчи по 1000 offer_id (лимит API)
              const batchSize = 1000;
              const batches: string[][] = [];
              for (let i = 0; i < offerIdList.length; i += batchSize) {
                batches.push(offerIdList.slice(i, i + batchSize));
              }
              
              // Получаем остатки параллельно (по 3 батча одновременно для избежания rate limit)
              const concurrency = 3;
              for (let i = 0; i < batches.length; i += concurrency) {
                const batchGroup = batches.slice(i, i + concurrency);
                const stocksPromises = batchGroup.map(async (batch) => {
                  try {
                    const stocksResponse: any = await client.post('/v4/product/info/stocks', {
                      filter: {
                        offer_id: batch,
                      },
                      limit: 1000,
                    });
                    return stocksResponse.data.items || [];
                  } catch (stockError: any) {
                    console.error(`Ошибка получения остатков для батча:`, stockError.message);
                    return [];
                  }
                });
                
                const stocksResults = await Promise.all(stocksPromises);
                stocksResults.flat().forEach((stockItem: any) => {
                  // /v4/product/info/stocks возвращает items с полями: offer_id, product_id, items (массив складов)
                  const offerKey = stockItem.offer_id?.toString();
                  const productKey = stockItem.product_id?.toString();
                  
                  if (offerKey) {
                    if (!stocksMap.has(offerKey)) {
                      stocksMap.set(offerKey, []);
                    }
                    // Преобразуем формат данных для совместимости
                    if (stockItem.items && Array.isArray(stockItem.items)) {
                      stockItem.items.forEach((warehouseItem: any) => {
                        stocksMap.get(offerKey)!.push({
                          ...warehouseItem,
                          offer_id: offerKey,
                          product_id: productKey,
                        });
                      });
                    }
                  }
                });
                
                // Небольшая задержка между группами батчей
                if (i + concurrency < batches.length) {
                  await new Promise(resolve => setTimeout(resolve, 200));
                }
              }
            } catch (error: any) {
              console.error('Ошибка при получении остатков:', error.message);
            }
          }

          const productsToSave = items.map((item: any) => {
            const offerId = item.offer_id?.toString();
            const stockItems = offerId ? (stocksMap.get(offerId) || []) : [];
            
            // Суммируем остатки по всем складам
            let totalPresent = 0;
            let totalReserved = 0;
            if (stockItems.length > 0) {
              stockItems.forEach((stockItem: any) => {
                // /v4/product/info/stocks возвращает items с полями: available, reserved
                const present = typeof stockItem.available === 'number' ? stockItem.available : 
                               (typeof stockItem.present === 'number' ? stockItem.present : parseInt(stockItem.present) || 0);
                const reserved = typeof stockItem.reserved === 'number' ? stockItem.reserved : parseInt(stockItem.reserved) || 0;
                totalPresent += present;
                totalReserved += reserved;
              });
            } else {
              // Если остатки не получены, используем данные из /v3/product/list
              totalPresent = item.stocks?.present || 0;
              totalReserved = item.stocks?.reserved || 0;
            }

            return {
              updateOne: {
                filter: { productId: item.product_id },
                update: {
                  $set: {
                    productId: item.product_id,
                    offerId: item.offer_id || '',
                    sku: item.sku || 0,
                    name: item.name || '',
                    price: parseFloat(item.price) || 0,
                    oldPrice: item.old_price ? parseFloat(item.old_price) : null,
                    currency: item.currency_code || 'RUB',
                    status: item.status || '',
                    images: item.images || [],
                    primaryImage: item.primary_image || null,
                    stock: {
                      coming: item.stocks?.coming || 0,
                      present: totalPresent,
                      reserved: totalReserved,
                    },
                    hasPrice: item.visibility_details?.has_price || false,
                    hasStock: totalPresent > 0 || item.visibility_details?.has_stock || false,
                    createdAt: item.created_at || '',
                    updatedAt: item.updated_at || '',
                    syncedAt: new Date(),
                  },
                },
                upsert: true,
              },
            };
          });

          await OzonProduct.bulkWrite(productsToSave, { ordered: false });
        }

        console.log(`📦 Синхронизировано товаров: ${totalSynced}`);
      } catch (error: any) {
        console.error('❌ Ошибка при синхронизации товаров OZON:', error.response?.data?.message || error.message);
        break;
      }
    }

    console.log(`✅ Автоматическая синхронизация завершена. Всего товаров: ${totalSynced}`);
  } catch (error: any) {
    console.error('❌ Ошибка при автоматической синхронизации OZON:', error.message);
  }
}

// Запускаем автоматическую синхронизацию каждый час
setInterval(() => {
  syncOzonProducts();
}, 60 * 60 * 1000); // 1 час в миллисекундах

// Запускаем синхронизацию при старте сервера (через 5 минут после запуска)
setTimeout(() => {
  syncOzonProducts();
}, 5 * 60 * 1000); // 5 минут

app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log('⏰ Автоматическая синхронизация OZON будет запущена через 5 минут и затем каждый час');
});

