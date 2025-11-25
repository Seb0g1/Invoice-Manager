import axios, { AxiosInstance } from 'axios';
import { YandexBusiness } from '../models/YandexBusiness';

interface YandexApiResponse<T> {
  status?: string;
  result?: T;
  errors?: Array<{ code: string; message: string }>;
}

interface OfferMapping {
  offerId: string;
  marketSku?: number;
  marketModelId?: number;
  categoryId?: number;
  vendorCode?: string;
  name?: string;
  description?: string;
  pictures?: string[];
  category?: string;
  availability?: string;
  status?: string;
}

interface OfferMappingsResponse {
  result: {
    offerMappings: OfferMapping[];
    paging?: {
      nextPageToken?: string;
    };
  };
}

interface StockItem {
  sku: string;
  items: Array<{
    type: string;
    count: number;
    updatedAt?: string;
  }>;
}

interface StocksResponse {
  result: {
    skus: StockItem[];
  };
}

interface PriceItem {
  offerId: string;
  price?: {
    value: string;
    currencyId: string;
  };
}

interface PricesResponse {
  result: {
    offers: PriceItem[];
    paging?: {
      nextPageToken?: string;
    };
  };
}

interface UpdatePriceRequest {
  offers: Array<{
    offerId: string;
    price: {
      value: string;
      currencyId: string;
    };
  }>;
}

interface UpdatePriceResponse {
  result: {
    status: string;
    errors?: Array<{ code: string; message: string }>;
  };
}

class YandexMarketService {
  private clients: Map<string, AxiosInstance> = new Map();
  private tokenCache: Map<string, { token: string; expiresAt: Date }> = new Map();

  /**
   * Получить клиент для работы с API конкретного бизнеса
   */
  async getClient(businessId: string): Promise<AxiosInstance | null> {
    // Проверяем кэш клиента
    if (this.clients.has(businessId)) {
      return this.clients.get(businessId)!;
    }

    // Загружаем бизнес из БД
    const business = await YandexBusiness.findOne({ businessId, enabled: true });
    if (!business || !business.accessToken) {
      console.error(`[YandexMarket] Бизнес ${businessId} не найден или не настроен`);
      return null;
    }

    // Проверяем, не истек ли токен
    if (business.tokenExpiresAt && business.tokenExpiresAt < new Date()) {
      // Токен истек, нужно обновить (здесь можно добавить логику обновления токена)
      console.warn(`[YandexMarket] Токен для бизнеса ${businessId} истек`);
      // TODO: Реализовать обновление токена через refreshToken
    }

    // Создаем клиент
    const client = axios.create({
      baseURL: 'https://api.partner.market.yandex.ru',
      headers: {
        'Api-Key': business.accessToken || '', // Используем Api-Key вместо OAuth для Market Yandex Go
        'Content-Type': 'application/json',
      },
      timeout: 60000, // Увеличенный таймаут для больших запросов
    });

    // Добавляем обработчик ошибок
    client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // Токен невалиден, удаляем клиент из кэша
          this.clients.delete(businessId);
          console.error(`[YandexMarket] Токен для бизнеса ${businessId} невалиден`);
        }
        return Promise.reject(error);
      }
    );

    this.clients.set(businessId, client);
    return client;
  }

  /**
   * Получить все офферы бизнеса с пагинацией
   */
  async getOfferMappings(
    businessId: string,
    onProgress?: (current: number, total: number, stage: string) => void
  ): Promise<OfferMapping[]> {
    const client = await this.getClient(businessId);
    if (!client) {
      throw new Error(`Бизнес ${businessId} не настроен`);
    }

    const allOffers: OfferMapping[] = [];
    let nextPageToken: string | undefined = undefined;
    let page = 0;

    onProgress?.(0, 0, 'Загрузка офферов...');

    while (true) {
      try {
        const params: any = {
          limit: 1000, // Максимальный лимит
        };

        if (nextPageToken) {
          params.page_token = nextPageToken;
        }

        const response = await client.get<OfferMappingsResponse>(
          `/businesses/${businessId}/offer-mappings`,
          { params }
        );

        if (response.data.result?.offerMappings) {
          allOffers.push(...response.data.result.offerMappings);
          onProgress?.(allOffers.length, allOffers.length, `Загружено офферов: ${allOffers.length}...`);

          nextPageToken = response.data.result.paging?.nextPageToken;
          page++;

          if (!nextPageToken) {
            break;
          }

          // Небольшая задержка между запросами
          await new Promise(resolve => setTimeout(resolve, 200));
        } else {
          break;
        }
      } catch (error: any) {
        console.error(`[YandexMarket] Ошибка получения офферов для бизнеса ${businessId}, страница ${page}:`, error.message);
        
        if (error.response?.status === 429) {
          // Rate limit, ждем и повторяем
          console.log('[YandexMarket] Rate limit, ожидание 5 секунд...');
          await new Promise(resolve => setTimeout(resolve, 5000));
          continue;
        }
        
        throw new Error(`Ошибка получения офферов: ${error.response?.data?.errors?.[0]?.message || error.message}`);
      }
    }

    return allOffers;
  }

  /**
   * Получить остатки для бизнеса
   */
  async getStocks(businessId: string, skus?: string[]): Promise<StockItem[]> {
    const client = await this.getClient(businessId);
    if (!client) {
      throw new Error(`Бизнес ${businessId} не настроен`);
    }

    try {
      const requestBody: any = {};
      if (skus && skus.length > 0) {
        requestBody.skus = skus;
      }

      const response = await client.post<StocksResponse>(
        `/businesses/${businessId}/offers/stocks`,
        requestBody
      );

      return response.data.result?.skus || [];
    } catch (error: any) {
      console.error(`[YandexMarket] Ошибка получения остатков для бизнеса ${businessId}:`, error.message);
      throw new Error(`Ошибка получения остатков: ${error.response?.data?.errors?.[0]?.message || error.message}`);
    }
  }

  /**
   * Получить цены для бизнеса с пагинацией
   */
  async getPrices(
    businessId: string,
    onProgress?: (current: number, total: number, stage: string) => void
  ): Promise<PriceItem[]> {
    const client = await this.getClient(businessId);
    if (!client) {
      throw new Error(`Бизнес ${businessId} не настроен`);
    }

    const allPrices: PriceItem[] = [];
    let nextPageToken: string | undefined = undefined;
    let page = 0;

    onProgress?.(0, 0, 'Загрузка цен...');

    while (true) {
      try {
        const requestBody: any = {
          limit: 1000,
        };

        if (nextPageToken) {
          requestBody.page_token = nextPageToken;
        }

        const response = await client.post<PricesResponse>(
          `/businesses/${businessId}/offers/prices`,
          requestBody
        );

        if (response.data.result?.offers) {
          allPrices.push(...response.data.result.offers);
          onProgress?.(allPrices.length, allPrices.length, `Загружено цен: ${allPrices.length}...`);

          nextPageToken = response.data.result.paging?.nextPageToken;
          page++;

          if (!nextPageToken) {
            break;
          }

          await new Promise(resolve => setTimeout(resolve, 200));
        } else {
          break;
        }
      } catch (error: any) {
        console.error(`[YandexMarket] Ошибка получения цен для бизнеса ${businessId}, страница ${page}:`, error.message);
        
        if (error.response?.status === 429) {
          await new Promise(resolve => setTimeout(resolve, 5000));
          continue;
        }
        
        throw new Error(`Ошибка получения цен: ${error.response?.data?.errors?.[0]?.message || error.message}`);
      }
    }

    return allPrices;
  }

  /**
   * Обновить цены для бизнеса
   */
  async updatePrices(
    businessId: string,
    offers: Array<{ offerId: string; price: { value: string; currencyId: string } }>
  ): Promise<{ success: boolean; errors?: Array<{ code: string; message: string }> }> {
    const client = await this.getClient(businessId);
    if (!client) {
      throw new Error(`Бизнес ${businessId} не настроен`);
    }

    try {
      // Разбиваем на батчи по 1000 офферов (лимит API)
      const batchSize = 1000;
      const batches: Array<Array<{ offerId: string; price: { value: string; currencyId: string } }>> = [];
      
      for (let i = 0; i < offers.length; i += batchSize) {
        batches.push(offers.slice(i, i + batchSize));
      }

      const allErrors: Array<{ code: string; message: string }> = [];

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const requestBody: UpdatePriceRequest = { offers: batch };

        try {
          const response = await client.put<UpdatePriceResponse>(
            `/businesses/${businessId}/offer-prices/updates`,
            requestBody
          );

          if (response.data.result?.errors) {
            allErrors.push(...response.data.result.errors);
          }

          // Задержка между батчами
          if (i < batches.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (error: any) {
          console.error(`[YandexMarket] Ошибка обновления цен для бизнеса ${businessId}, батч ${i + 1}:`, error.message);
          
          if (error.response?.status === 429) {
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
      console.error(`[YandexMarket] Критическая ошибка обновления цен для бизнеса ${businessId}:`, error.message);
      throw new Error(`Ошибка обновления цен: ${error.response?.data?.errors?.[0]?.message || error.message}`);
    }
  }

  /**
   * Retry с задержкой
   */
  private async retryWithDelay<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        
        if (error.response?.status === 429 || error.response?.status >= 500) {
          const delay = baseDelay * Math.pow(2, attempt);
          console.log(`[YandexMarket] Retry ${attempt + 1}/${maxRetries} через ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        throw error;
      }
    }

    throw lastError || new Error('Неизвестная ошибка');
  }
}

export const yandexMarketService = new YandexMarketService();

