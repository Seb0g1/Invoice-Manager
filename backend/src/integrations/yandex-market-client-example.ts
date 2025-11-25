/**
 * Пример использования сгенерированного клиента Яндекс Маркет API
 * 
 * Этот файл демонстрирует, как использовать сгенерированный из OpenAPI клиент
 * вместо ручного создания axios запросов.
 * 
 * После генерации клиента выполните:
 * 1. npm run generate-yandex-client
 * 2. Импортируйте и используйте классы из ../generated/yandex-market-api
 */

// TODO: Раскомментировать после генерации клиента из OpenAPI спецификации
// import { Configuration, DefaultApi } from '../generated/yandex-market-api';
import { YandexBusiness } from '../models/YandexBusiness';

/**
 * Обертка для работы с API Яндекс Маркета через сгенерированный клиент
 */
export class YandexMarketApiClient {
  // TODO: Раскомментировать после генерации клиента
  // private apiInstances: Map<string, DefaultApi> = new Map();
  // private configurations: Map<string, Configuration> = new Map();

  /**
   * Получить или создать экземпляр API для бизнеса
   */
  async getApiInstance(businessId: string): Promise<any> {
    // TODO: Раскомментировать после генерации клиента
    // Проверяем кэш
    // if (this.apiInstances.has(businessId)) {
    //   return this.apiInstances.get(businessId)!;
    // }

    // Загружаем бизнес из БД
    const business = await YandexBusiness.findOne({ businessId, enabled: true });
    if (!business || !business.accessToken) {
      console.error(`[YandexMarket] Бизнес ${businessId} не найден или не настроен`);
      return null;
    }

    // Проверяем, не истек ли токен
    if (business.tokenExpiresAt && business.tokenExpiresAt < new Date()) {
      console.warn(`[YandexMarket] Токен для бизнеса ${businessId} истек`);
      // TODO: Реализовать обновление токена через refreshToken
    }

    // TODO: Раскомментировать после генерации клиента
    // Создаем конфигурацию
    // const configuration = new Configuration({
    //   basePath: 'https://api.partner.market.yandex.ru',
    //   accessToken: business.accessToken,
    // });

    // Создаем экземпляр API
    // const api = new DefaultApi(configuration);
    
    // Сохраняем в кэш
    // this.configurations.set(businessId, configuration);
    // this.apiInstances.set(businessId, api);

    // return api;
    throw new Error('Сгенерированный клиент еще не создан. См. backend/YANDEX_OPENAPI_CLIENT.md');
  }

  /**
   * Получить список офферов бизнеса
   */
  async getOfferMappings(
    businessId: string,
    params?: {
      limit?: number;
      pageToken?: string;
    }
  ) {
    const api = await this.getApiInstance(businessId);
    if (!api) {
      throw new Error(`Бизнес ${businessId} не настроен`);
    }

    try {
      // Используем сгенерированный метод API
      const response = await api.getBusinessesBusinessIdOfferMappings(
        businessId,
        params?.limit,
        params?.pageToken
      );
      
      return response.data;
    } catch (error: any) {
      console.error(`[YandexMarket] Ошибка получения офферов:`, error);
      throw new Error(
        error.response?.data?.errors?.[0]?.message || 
        error.message || 
        'Ошибка получения офферов'
      );
    }
  }

  /**
   * Получить остатки товаров
   */
  async getStocks(
    businessId: string,
    requestBody?: {
      skus?: string[];
      warehouseIds?: number[];
    }
  ) {
    const api = await this.getApiInstance(businessId);
    if (!api) {
      throw new Error(`Бизнес ${businessId} не настроен`);
    }

    try {
      const response = await api.postBusinessesBusinessIdOffersStocks(
        businessId,
        requestBody || {}
      );
      
      return response.data;
    } catch (error: any) {
      console.error(`[YandexMarket] Ошибка получения остатков:`, error);
      throw new Error(
        error.response?.data?.errors?.[0]?.message || 
        error.message || 
        'Ошибка получения остатков'
      );
    }
  }

  /**
   * Получить цены товаров
   */
  async getPrices(
    businessId: string,
    requestBody?: {
      limit?: number;
      pageToken?: string;
      offerIds?: string[];
    }
  ) {
    const api = await this.getApiInstance(businessId);
    if (!api) {
      throw new Error(`Бизнес ${businessId} не настроен`);
    }

    try {
      const response = await api.postBusinessesBusinessIdOffersPrices(
        businessId,
        requestBody || {}
      );
      
      return response.data;
    } catch (error: any) {
      console.error(`[YandexMarket] Ошибка получения цен:`, error);
      throw new Error(
        error.response?.data?.errors?.[0]?.message || 
        error.message || 
        'Ошибка получения цен'
      );
    }
  }

  /**
   * Обновить цены товаров
   */
  async updatePrices(
    businessId: string,
    offers: Array<{
      offerId: string;
      price: {
        value: string;
        currencyId: string;
      };
    }>
  ) {
    const api = await this.getApiInstance(businessId);
    if (!api) {
      throw new Error(`Бизнес ${businessId} не настроен`);
    }

    try {
      // Разбиваем на батчи по 1000 офферов (лимит API)
      const batchSize = 1000;
      const batches: Array<typeof offers> = [];
      
      for (let i = 0; i < offers.length; i += batchSize) {
        batches.push(offers.slice(i, i + batchSize));
      }

      const allErrors: Array<{ code: string; message: string }> = [];

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];

        try {
          const response = await api.putBusinessesBusinessIdOfferPricesUpdates(
            businessId,
            { offers: batch }
          );

          // Проверяем ошибки в ответе
          if (response.data.result?.errors) {
            allErrors.push(...response.data.result.errors);
          }

          // Задержка между батчами
          if (i < batches.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (error: any) {
          console.error(`[YandexMarket] Ошибка обновления цен, батч ${i + 1}:`, error);
          
          if (error.response?.status === 429) {
            // Rate limit, ждем и повторяем
            await new Promise(resolve => setTimeout(resolve, 5000));
            i--; // Повторяем батч
            continue;
          }

          allErrors.push({
            code: error.response?.status?.toString() || 'UNKNOWN',
            message: error.response?.data?.errors?.[0]?.message || error.message,
          });
        }
      }

      return {
        success: allErrors.length === 0,
        errors: allErrors.length > 0 ? allErrors : undefined,
      };
    } catch (error: any) {
      console.error(`[YandexMarket] Критическая ошибка обновления цен:`, error);
      throw new Error(
        error.response?.data?.errors?.[0]?.message || 
        error.message || 
        'Ошибка обновления цен'
      );
    }
  }

  /**
   * Очистить кэш для бизнеса (например, после обновления токена)
   * TODO: Раскомментировать после генерации клиента
   */
  clearCache(businessId: string): void {
    // TODO: Раскомментировать после генерации клиента
    // this.apiInstances.delete(businessId);
    // this.configurations.delete(businessId);
    console.warn('clearCache: Сгенерированный клиент еще не создан');
  }

  /**
   * Очистить весь кэш
   * TODO: Раскомментировать после генерации клиента
   */
  clearAllCache(): void {
    // TODO: Раскомментировать после генерации клиента
    // this.apiInstances.clear();
    // this.configurations.clear();
    console.warn('clearAllCache: Сгенерированный клиент еще не создан');
  }
}

// Экспортируем singleton экземпляр
export const yandexMarketApiClient = new YandexMarketApiClient();

