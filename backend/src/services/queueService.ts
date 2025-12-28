/**
 * Простая очередь для асинхронной обработки задач
 * Используется для обработки больших объемов данных (10k-30k товаров)
 */

interface QueueTask<T> {
  id: string;
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  retries: number;
  maxRetries: number;
}

class QueueService {
  private queue: QueueTask<any>[] = [];
  private processing = false;
  private concurrency: number;
  private delayBetweenBatches: number;

  constructor(concurrency: number = 5, delayBetweenBatches: number = 200) {
    this.concurrency = concurrency;
    this.delayBetweenBatches = delayBetweenBatches;
  }

  /**
   * Добавить задачу в очередь
   */
  async add<T>(fn: () => Promise<T>, maxRetries: number = 3): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const task: QueueTask<T> = {
        id: Math.random().toString(36).substring(7),
        fn,
        resolve,
        reject,
        retries: 0,
        maxRetries,
      };

      this.queue.push(task);
      this.process();
    });
  }

  /**
   * Обработка очереди
   */
  private async process() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, this.concurrency);
      
      await Promise.allSettled(
        batch.map(async (task) => {
          try {
            const result = await task.fn();
            task.resolve(result);
          } catch (error: any) {
            if (task.retries < task.maxRetries) {
              // Повторяем задачу
              task.retries++;
              this.queue.push(task);
              
              // Экспоненциальная задержка
              const delay = 1000 * Math.pow(2, task.retries);
              await new Promise(resolve => setTimeout(resolve, delay));
            } else {
              task.reject(error);
            }
          }
        })
      );

      // Задержка между батчами
      if (this.queue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, this.delayBetweenBatches));
      }
    }

    this.processing = false;
  }

  /**
   * Очистить очередь
   */
  clear() {
    this.queue.forEach(task => {
      task.reject(new Error('Очередь очищена'));
    });
    this.queue = [];
  }

  /**
   * Получить размер очереди
   */
  getSize(): number {
    return this.queue.length;
  }
}

export const queueService = new QueueService(5, 200);

