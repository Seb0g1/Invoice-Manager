import * as cron from 'node-cron';
import { YandexBusiness } from '../models/YandexBusiness';

interface ScheduledTask {
  name: string;
  task: ReturnType<typeof cron.schedule>;
  enabled: boolean;
}

class SchedulerService {
  private tasks: Map<string, ScheduledTask> = new Map();
  private isRunning = false;

  /**
   * Инициализация планировщика
   */
  async initialize() {
    if (this.isRunning) {
      console.log('[Scheduler] Планировщик уже запущен');
      return;
    }

    console.log('[Scheduler] Инициализация планировщика задач...');

    // Полная синхронизация товаров Market Yandex Go - раз в сутки в 3:00
    this.scheduleTask('full-sync-products-go', '0 3 * * *', async () => {
      console.log('[Scheduler] Запуск полной синхронизации товаров Market Yandex Go...');
      try {
        const { syncAllProducts } = await import('../controllers/yandexMarketGoController');
        const mockReq = { user: { role: 'director' } } as any;
        const mockRes = {
          json: (data: any) => {
            console.log('[Scheduler] Полная синхронизация Market Yandex Go завершена:', data);
          },
          status: () => mockRes,
        } as any;
        await syncAllProducts(mockReq, mockRes);
      } catch (error: any) {
        console.error('[Scheduler] Ошибка полной синхронизации Market Yandex Go:', error.message);
      }
    });

    // Синхронизация остатков Market Yandex Go - каждый час
    this.scheduleTask('sync-stocks-go', '0 * * * *', async () => {
      console.log('[Scheduler] Запуск синхронизации остатков Market Yandex Go...');
      try {
        const { syncStocks } = await import('../controllers/yandexMarketGoController');
        const mockReq = { user: { role: 'director' } } as any;
        const mockRes = {
          json: (data: any) => {
            console.log('[Scheduler] Синхронизация остатков Market Yandex Go завершена:', data);
          },
          status: () => mockRes,
        } as any;
        await syncStocks(mockReq, mockRes);
      } catch (error: any) {
        console.error('[Scheduler] Ошибка синхронизации остатков Market Yandex Go:', error.message);
      }
    });

    // Синхронизация цен Market Yandex Go - каждый час (смещение на 30 минут от остатков)
    this.scheduleTask('sync-prices-go', '30 * * * *', async () => {
      console.log('[Scheduler] Запуск синхронизации цен Market Yandex Go...');
      try {
        const { syncPrices } = await import('../controllers/yandexMarketGoController');
        const mockReq = { user: { role: 'director' } } as any;
        const mockRes = {
          json: (data: any) => {
            console.log('[Scheduler] Синхронизация цен Market Yandex Go завершена:', data);
          },
          status: () => mockRes,
        } as any;
        await syncPrices(mockReq, mockRes);
      } catch (error: any) {
        console.error('[Scheduler] Ошибка синхронизации цен Market Yandex Go:', error.message);
      }
    });

    // Полная синхронизация товаров OZON - раз в сутки в 4:00
    this.scheduleTask('full-sync-ozon', '0 4 * * *', async () => {
      console.log('[Scheduler] Запуск полной синхронизации товаров OZON...');
      try {
        const OzonConfig = (await import('../models/OzonConfig')).default;
        const config = await OzonConfig.findOne({ enabled: true });
        
        if (!config || !config.clientId || !config.apiKey) {
          console.log('[Scheduler] OZON API не настроен, пропускаем синхронизацию');
          return;
        }

        const ozonService = (await import('./ozonService')).default;
        await ozonService.initialize();
        
        const result = await ozonService.syncAllProducts((current, total, stage) => {
          console.log(`[Scheduler] OZON Sync: ${stage} - ${current}/${total}`);
        });
        
        console.log(`[Scheduler] Полная синхронизация OZON завершена: ${result.synced}/${result.total} товаров за ${result.duration}с. Ошибок: ${result.errors}`);
      } catch (error: any) {
        console.error('[Scheduler] Ошибка полной синхронизации OZON:', error.message);
      }
    });

    this.isRunning = true;
    console.log('[Scheduler] Планировщик задач запущен');
  }

  /**
   * Запланировать задачу
   */
  private scheduleTask(name: string, cronExpression: string, callback: () => Promise<void>) {
    if (this.tasks.has(name)) {
      console.log(`[Scheduler] Задача ${name} уже существует, пропускаем`);
      return;
    }

    const task = cron.schedule(cronExpression, async () => {
      try {
        await callback();
      } catch (error: any) {
        console.error(`[Scheduler] Ошибка выполнения задачи ${name}:`, error.message);
      }
    }, {
      timezone: 'Europe/Moscow',
    });

    this.tasks.set(name, {
      name,
      task,
      enabled: true,
    });

    console.log(`[Scheduler] Задача ${name} запланирована: ${cronExpression}`);
  }

  /**
   * Остановить задачу
   */
  stopTask(name: string) {
    const scheduledTask = this.tasks.get(name);
    if (scheduledTask) {
      scheduledTask.task.stop();
      scheduledTask.enabled = false;
      console.log(`[Scheduler] Задача ${name} остановлена`);
    }
  }

  /**
   * Запустить задачу
   */
  startTask(name: string) {
    const scheduledTask = this.tasks.get(name);
    if (scheduledTask) {
      scheduledTask.task.start();
      scheduledTask.enabled = true;
      console.log(`[Scheduler] Задача ${name} запущена`);
    }
  }

  /**
   * Получить статус всех задач
   */
  getTasksStatus() {
    const status: Array<{ name: string; enabled: boolean }> = [];
    this.tasks.forEach((task) => {
      status.push({
        name: task.name,
        enabled: task.enabled,
      });
    });
    return status;
  }

  /**
   * Остановить все задачи
   */
  stopAll() {
    this.tasks.forEach((task) => {
      task.task.stop();
      task.enabled = false;
    });
    this.isRunning = false;
    console.log('[Scheduler] Все задачи остановлены');
  }
}

export const schedulerService = new SchedulerService();

