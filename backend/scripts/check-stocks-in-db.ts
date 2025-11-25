import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Загружаем переменные окружения
dotenv.config({ path: path.join(__dirname, '../.env') });

import { OzonProduct } from '../src/models/OzonProduct';

async function checkStocksInDB() {
  try {
    // Подключаемся к MongoDB
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/invoice-db';
    await mongoose.connect(mongoUri);
    console.log('✅ Подключено к MongoDB');

    // Находим товары с остатками
    const productsWithStocks = await OzonProduct.find({
      'stock.present': { $gt: 0 }
    })
      .limit(10)
      .lean();

    console.log(`\n📦 Товары с остатками (найдено ${productsWithStocks.length} из первых 10):`);
    productsWithStocks.forEach((p: any) => {
      console.log({
        productId: p.productId,
        name: p.name,
        stock: p.stock,
        hasStock: p.hasStock,
        syncedAt: p.syncedAt
      });
    });

    // Находим товары без остатков
    const productsWithoutStocks = await OzonProduct.find({
      $or: [
        { 'stock.present': { $exists: false } },
        { 'stock.present': 0 },
        { stock: null }
      ]
    })
      .limit(10)
      .lean();

    console.log(`\n❌ Товары без остатков (найдено ${productsWithoutStocks.length} из первых 10):`);
    productsWithoutStocks.forEach((p: any) => {
      console.log({
        productId: p.productId,
        name: p.name,
        stock: p.stock,
        stockType: typeof p.stock,
        hasStock: p.hasStock,
        syncedAt: p.syncedAt
      });
    });

    // Статистика
    const totalProducts = await OzonProduct.countDocuments({});
    const productsWithStocksCount = await OzonProduct.countDocuments({
      'stock.present': { $gt: 0 }
    });
    const productsWithoutStocksCount = await OzonProduct.countDocuments({
      $or: [
        { 'stock.present': { $exists: false } },
        { 'stock.present': 0 },
        { stock: null }
      ]
    });

    console.log(`\n📊 Статистика:`);
    console.log(`Всего товаров: ${totalProducts}`);
    console.log(`С остатками: ${productsWithStocksCount}`);
    console.log(`Без остатков: ${productsWithoutStocksCount}`);

    await mongoose.disconnect();
    console.log('\n✅ Отключено от MongoDB');
  } catch (error: any) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  }
}

checkStocksInDB();

