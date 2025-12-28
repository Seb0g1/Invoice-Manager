/**
 * Скрипт для синхронизации товаров OZON
 * Можно запускать вручную или через cron
 * 
 * Использование:
 *   npm run sync-ozon
 *   или
 *   ts-node backend/scripts/sync-ozon-products.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import ozonService from '../src/services/ozonService';
import OzonConfig from '../src/models/OzonConfig';

// Загружаем переменные окружения
// Пробуем несколько возможных путей
const possibleEnvPaths = [
  path.join(__dirname, '../../.env'),
  path.join(__dirname, '../.env'),
  path.join(process.cwd(), '.env'),
];

for (const envPath of possibleEnvPaths) {
  try {
    dotenv.config({ path: envPath });
    if (process.env.MONGO_URI) {
      break; // Если нашли .env с нужными переменными, прекращаем поиск
    }
  } catch (e) {
    // Продолжаем поиск
  }
}


async function syncOzonProducts() {
  try {
    console.log('🚀 Запуск синхронизации товаров OZON...\n');

    // Подключаемся к MongoDB
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/invoice-db';
    await mongoose.connect(mongoUri);
    console.log('✅ Подключено к MongoDB\n');

    // Проверяем настройки OZON API
    const config = await OzonConfig.findOne();
    if (!config || !config.enabled || !config.clientId || !config.apiKey) {
      console.error('❌ OZON API не настроен. Пожалуйста, настройте API в разделе Настройки');
      process.exit(1);
    }

    console.log(`📋 Настройки OZON API найдены (Client ID: ${config.clientId.substring(0, 10)}...)\n`);

    // Инициализируем сервис
    await ozonService.initialize();

    // Запускаем синхронизацию
    const result = await ozonService.syncAllProducts((current, total, stage) => {
      const percent = total > 0 ? Math.round((current / total) * 100) : 0;
      process.stdout.write(`\r${stage} - ${current}/${total} (${percent}%)`);
    });

    console.log('\n\n✅ Синхронизация завершена!');
    console.log(`📊 Статистика:`);
    console.log(`   - Всего товаров: ${result.total}`);
    console.log(`   - Синхронизировано: ${result.synced}`);
    console.log(`   - Ошибок: ${result.errors}`);
    console.log(`   - Время выполнения: ${result.duration}с`);
    console.log(`   - Средняя скорость: ${result.duration > 0 ? Math.round(result.synced / result.duration) : 0} товаров/сек\n`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Ошибка при синхронизации:', error.message);
    console.error(error.stack);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Запускаем синхронизацию
syncOzonProducts();

