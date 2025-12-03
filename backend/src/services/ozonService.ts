import axios, { AxiosInstance, AxiosError } from 'axios';
import OzonConfig from '../models/OzonConfig';
import { logger } from '../utils/logger';

// Функция для задержки
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Функция для retry с экспоненциальной задержкой
async function retryWithDelay<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Проверяем, является ли это rate limit ошибкой
      const isRateLimit = error.response?.status === 429 || 
                         error.message?.includes('rate limit') ||
                         error.message?.includes('request rate limit');
      
      if (isRateLimit && attempt < maxRetries - 1) {
        // Экспоненциальная задержка: 1s, 2s, 4s
        const delayMs = baseDelay * Math.pow(2, attempt);
        console.log(`Rate limit hit, retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries})`);
        await delay(delayMs);
        continue;
      }
      
      throw error;
    }
  }
  
  throw lastError;
}

interface OzonProduct {
  product_id: number;
  offer_id: string;
  name: string;
  sku: number;
  price: string;
  old_price: string;
  premium_price: string;
  recommended_price: string;
  min_ozon_price: string;
  min_price: string;
  currency_code: string;
  category_id: number;
  status: string;
  images: string[];
  primary_image: string;
  stocks: {
    coming: number;
    present: number;
    reserved: number;
  };
  visibility_details: {
    has_price: boolean;
    has_stock: boolean;
  };
  created_at: string;
  updated_at: string;
}

interface OzonApiResponse {
  result: {
    items: OzonProduct[];
    total: number;
    last_id: string;
  };
}

class OzonService {
  private client: AxiosInstance | null = null;
  private config: { clientId: string; apiKey: string } | null = null;

  async initialize() {
    const config = await OzonConfig.findOne();
    if (!config || !config.enabled || !config.clientId || !config.apiKey) {
      this.client = null;
      this.config = null;
      return false;
    }

    this.config = {
      clientId: config.clientId,
      apiKey: config.apiKey,
    };

    this.client = axios.create({
      baseURL: 'https://api-seller.ozon.ru',
      headers: {
        'Client-Id': config.clientId,
        'Api-Key': config.apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    return true;
  }

  async getProducts(lastId?: string, limit: number = 100): Promise<OzonApiResponse> {
    if (!this.client) {
      await this.initialize();
      if (!this.client) {
        throw new Error('OZON API не настроен');
      }
    }

    return retryWithDelay(async () => {
      try {
        // Используем v3 API согласно документации
        const requestBody: any = {
          filter: {},
          limit: Math.min(Math.max(limit, 1), 1000), // Минимум 1, максимум 1000
        };

        // Добавляем last_id только если он указан
        if (lastId) {
          requestBody.last_id = lastId;
        }

        const response = await this.client!.post<OzonApiResponse>('/v3/product/list', requestBody);

        return response.data;
      } catch (error: any) {
        if (error.response) {
          const errorMessage = error.response.data?.message || error.response.data?.error || error.response.statusText;
          throw new Error(`OZON API ошибка: ${errorMessage}`);
        }
        throw new Error('Ошибка подключения к OZON API');
      }
    });
  }

  /**
   * Получение списка товаров через /v3/product/list с курсорной пагинацией
   * Используется для быстрой синхронизации большого количества товаров
   * Этот метод поддерживает получение всех товаров без фильтра
   */
  async getProductInfoListPaginated(
    lastId?: string | null,
    limit: number = 1000
  ): Promise<{
    items: any[];
    total: number;
    last_id: string | null;
  }> {
    if (!this.client) {
      await this.initialize();
      if (!this.client) {
        throw new Error('OZON API не настроен');
      }
    }

    return retryWithDelay(async () => {
      try {
        const requestBody: any = {
          filter: {}, // Пустой фильтр для получения всех товаров
          limit: Math.min(Math.max(limit, 1), 1000), // Минимум 1, максимум 1000
        };

        // Добавляем last_id только если он указан и не пустой
        if (lastId && lastId !== '') {
          requestBody.last_id = lastId;
        }

        // Используем /v3/product/list вместо /v3/product/info/list
        // так как /v3/product/info/list требует фильтр (offer_id, product_id или sku)
        const response = await this.client!.post('/v3/product/list', requestBody);

        return {
          items: response.data.result?.items || [],
          total: response.data.result?.total || 0,
          last_id: response.data.result?.last_id || null,
        };
      } catch (error: any) {
        if (error.response) {
          const errorMessage = error.response.data?.message || error.response.data?.error || error.response.statusText;
          throw new Error(`OZON API ошибка: ${errorMessage}`);
        }
        throw new Error('Ошибка подключения к OZON API');
      }
    });
  }


  async getStocks(sku: number[]): Promise<any> {
    if (!this.client) {
      await this.initialize();
      if (!this.client) {
        throw new Error('OZON API не настроен');
      }
    }

    try {
      const response = await this.client.post('/v3/product/info/stocks', {
        sku,
      });

      return response.data;
    } catch (error: any) {
      if (error.response) {
        throw new Error(`OZON API ошибка: ${error.response.data?.message || error.response.statusText}`);
      }
      throw new Error('Ошибка подключения к OZON API');
    }
  }

  /**
   * Получение цен товаров через /v5/product/info/prices
   * @param filter - фильтр по offer_id, product_id или visibility
   * @param limit - лимит товаров (максимум 1000)
   * @param cursor - курсор для пагинации
   */
  async getProductPrices(
    filter?: {
      offer_id?: string[];
      product_id?: number[];
      visibility?: 'ALL' | 'VISIBLE' | 'INVISIBLE';
    },
    limit: number = 1000,
    cursor?: string | null
  ): Promise<{
    items: Array<{
      product_id: number;
      offer_id: string;
      price: number;
      old_price?: number;
      currency_code: string;
      auto_action_enabled?: boolean;
    }>;
    cursor: string | null;
    total?: number;
    last_id?: string | null; // Для обратной совместимости
  }> {
    if (!this.client) {
      await this.initialize();
      if (!this.client) {
        throw new Error('OZON API не настроен');
      }
    }

    return retryWithDelay(async () => {
      try {
        const requestBody: any = {
          filter: filter || {},
          limit: Math.min(Math.max(limit, 1), 1000),
        };

        // Используем cursor для пагинации (новый API v5)
        if (cursor && cursor !== '') {
          requestBody.cursor = cursor;
        }

        const response = await this.client!.post('/v5/product/info/prices', requestBody);

        // Преобразуем данные из нового формата API v5
        const items = (response.data.items || []).map((item: any) => ({
          product_id: item.product_id,
          offer_id: item.offer_id,
          price: item.price?.price || 0,
          old_price: item.price?.old_price || null,
          currency_code: item.price?.currency_code || 'RUB',
          auto_action_enabled: item.price?.auto_action_enabled || false,
        }));

        return {
          items,
          cursor: response.data.cursor || null,
          total: response.data.total,
          last_id: response.data.cursor || null, // Для обратной совместимости
        };
      } catch (error: any) {
        if (error.response) {
          const errorMessage = error.response.data?.message || error.response.data?.error || error.response.statusText;
          throw new Error(`OZON API ошибка: ${errorMessage}`);
        }
        throw new Error('Ошибка подключения к OZON API');
      }
    });
  }

  async getProductPictures(productIds: string[]): Promise<any> {
    if (!this.client) {
      await this.initialize();
      if (!this.client) {
        throw new Error('OZON API не настроен');
      }
    }

    if (!productIds || productIds.length === 0) {
      throw new Error('Список идентификаторов товаров обязателен');
    }

    if (productIds.length > 1000) {
      throw new Error('Максимум 1000 товаров за один запрос');
    }

    return retryWithDelay(async () => {
      try {
        const response = await this.client!.post('/v2/product/pictures/info', {
          product_id: productIds,
        });

        return response.data;
      } catch (error: any) {
        if (error.response) {
          const errorMessage = error.response.data?.message || error.response.data?.error || error.response.statusText;
          throw new Error(`OZON API ошибка: ${errorMessage}`);
        }
        throw new Error('Ошибка подключения к OZON API');
      }
    });
  }

  async getProductAttributes(
    filter?: any,
    lastId?: string,
    limit: number = 100,
    sortBy: 'sku' | 'offer_id' | 'id' | 'title' = 'id',
    sortDir: 'asc' | 'desc' = 'asc'
  ): Promise<any> {
    if (!this.client) {
      await this.initialize();
      if (!this.client) {
        throw new Error('OZON API не настроен');
      }
    }

    return retryWithDelay(async () => {
      try {
        const requestBody: any = {
          filter: filter || {},
          limit: Math.min(Math.max(limit, 1), 1000), // Минимум 1, максимум 1000
          sort_by: sortBy,
          sort_dir: sortDir,
        };

        // Добавляем last_id только если он указан
        if (lastId) {
          requestBody.last_id = lastId;
        }

        const response = await this.client!.post('/v4/product/info/attributes', requestBody);

        return response.data;
      } catch (error: any) {
        if (error.response) {
          const errorMessage = error.response.data?.message || error.response.data?.error || error.response.statusText;
          throw new Error(`OZON API ошибка: ${errorMessage}`);
        }
        throw new Error('Ошибка подключения к OZON API');
      }
    });
  }

  async getStocksByWarehouse(sku?: string[], offerId?: string[]): Promise<any> {
    if (!this.client) {
      await this.initialize();
      if (!this.client) {
        throw new Error('OZON API не настроен');
      }
    }

    if ((!sku || sku.length === 0) && (!offerId || offerId.length === 0)) {
      throw new Error('Необходимо указать либо sku, либо offer_id');
    }

    try {
      // Используем новый метод /v4/product/info/stocks
      // Этот метод использует фильтры по offer_id или product_id
      const requestBody: any = {
        filter: {},
        limit: 1000, // Максимальный лимит
      };

      // Если указан offer_id, используем его
      if (offerId && offerId.length > 0) {
        requestBody.filter.offer_id = offerId;
      } else if (sku && sku.length > 0) {
        // Если указан только SKU, нужно сначала получить offer_id или product_id
        // Для этого используем старый метод как fallback
        const oldRequestBody: any = {};
        oldRequestBody.sku = sku;
        const response = await this.client.post('/v1/product/info/stocks-by-warehouse/fbs', oldRequestBody);
        return response.data;
      }

      const response = await this.client.post('/v4/product/info/stocks', requestBody);

      return response.data;
    } catch (error: any) {
      if (error.response) {
        const errorMessage = error.response.data?.message || error.response.data?.error || error.response.statusText;
        throw new Error(`OZON API ошибка: ${errorMessage}`);
      }
      throw new Error('Ошибка подключения к OZON API');
    }
  }

  async updatePrices(prices: Array<{
    offer_id?: string;
    product_id?: number;
    price: string;
    old_price?: string;
    premium_price?: string;
    min_price?: string;
    auto_action_enabled?: boolean;
  }>): Promise<any> {
    if (!this.client) {
      await this.initialize();
      if (!this.client) {
        throw new Error('OZON API не настроен');
      }
    }

    if (!prices || prices.length === 0) {
      throw new Error('Список цен обязателен');
    }

    if (prices.length > 1000) {
      throw new Error('Максимум 1000 товаров за один запрос');
    }

    try {
      const response = await this.client.post('/v1/product/import/prices', {
        prices: prices,
      });

      return response.data;
    } catch (error: any) {
      if (error.response) {
        const errorMessage = error.response.data?.message || error.response.data?.error || error.response.statusText;
        throw new Error(`OZON API ошибка: ${errorMessage}`);
      }
      throw new Error('Ошибка подключения к OZON API');
    }
  }

  async getChats(filter?: any, limit: number = 30, cursor?: string): Promise<any> {
    if (!this.client) {
      await this.initialize();
      if (!this.client) {
        throw new Error('OZON API не настроен');
      }
    }

    try {
      const requestBody: any = {
        filter: filter || {},
        limit: Math.min(Math.max(limit, 1), 100),
      };

      if (cursor) {
        requestBody.cursor = cursor;
      }

      const response = await this.client.post('/v3/chat/list', requestBody);

      return response.data;
    } catch (error: any) {
      if (error.response) {
        const errorMessage = error.response.data?.message || error.response.data?.error || error.response.statusText;
        throw new Error(`OZON API ошибка: ${errorMessage}`);
      }
      throw new Error('Ошибка подключения к OZON API');
    }
  }

  async getChatHistory(chatId: string, limit: number = 50, direction: 'Forward' | 'Backward' = 'Backward', fromMessageId?: number, filter?: any): Promise<any> {
    if (!this.client) {
      await this.initialize();
      if (!this.client) {
        throw new Error('OZON API не настроен');
      }
    }

    try {
      const requestBody: any = {
        chat_id: chatId,
        limit: Math.min(Math.max(limit, 1), 1000),
        direction: direction,
      };

      if (fromMessageId) {
        requestBody.from_message_id = fromMessageId;
      }

      if (filter) {
        requestBody.filter = filter;
      }

      // Используем v3 API согласно новой документации
      const response = await this.client.post('/v3/chat/history', requestBody);

      return response.data;
    } catch (error: any) {
      if (error.response) {
        const errorMessage = error.response.data?.message || error.response.data?.error || error.response.statusText;
        throw new Error(`OZON API ошибка: ${errorMessage}`);
      }
      throw new Error('Ошибка подключения к OZON API');
    }
  }

  async sendChatMessage(chatId: string, text: string): Promise<any> {
    if (!this.client) {
      await this.initialize();
      if (!this.client) {
        throw new Error('OZON API не настроен');
      }
    }

    if (!text || text.length < 1 || text.length > 1000) {
      throw new Error('Текст сообщения должен быть от 1 до 1000 символов');
    }

    try {
      const response = await this.client.post('/v1/chat/send/message', {
        chat_id: chatId,
        text: text,
      });

      return response.data;
    } catch (error: any) {
      if (error.response) {
        const errorMessage = error.response.data?.message || error.response.data?.error || error.response.statusText;
        throw new Error(`OZON API ошибка: ${errorMessage}`);
      }
      throw new Error('Ошибка подключения к OZON API');
    }
  }

  async startChat(postingNumber: string): Promise<any> {
    if (!this.client) {
      await this.initialize();
      if (!this.client) {
        throw new Error('OZON API не настроен');
      }
    }

    try {
      const response = await this.client.post('/v1/chat/start', {
        posting_number: postingNumber,
      });

      return response.data;
    } catch (error: any) {
      if (error.response) {
        const errorMessage = error.response.data?.message || error.response.data?.error || error.response.statusText;
        throw new Error(`OZON API ошибка: ${errorMessage}`);
      }
      throw new Error('Ошибка подключения к OZON API');
    }
  }

  async markChatAsRead(chatId: string, fromMessageId?: number): Promise<any> {
    if (!this.client) {
      await this.initialize();
      if (!this.client) {
        throw new Error('OZON API не настроен');
      }
    }

    try {
      const requestBody: any = {
        chat_id: chatId,
      };

      if (fromMessageId) {
        requestBody.from_message_id = fromMessageId;
      }

      const response = await this.client.post('/v2/chat/read', requestBody);

      return response.data;
    } catch (error: any) {
      if (error.response) {
        const errorMessage = error.response.data?.message || error.response.data?.error || error.response.statusText;
        throw new Error(`OZON API ошибка: ${errorMessage}`);
      }
      throw new Error('Ошибка подключения к OZON API');
    }
  }

  async getAnalyticsData(
    dateFrom: string,
    dateTo: string,
    metrics: string[],
    dimension: string[],
    filters: any[] = [],
    limit: number = 1000,
    offset: number = 0,
    sort: any[] = []
  ): Promise<any> {
    if (!this.client) {
      await this.initialize();
      if (!this.client) {
        throw new Error('OZON API не настроен');
      }
    }

    try {
      const requestBody: any = {
        date_from: dateFrom,
        date_to: dateTo,
        metrics: metrics,
        dimension: dimension,
        filters: filters,
        limit: Math.min(Math.max(limit, 1), 1000),
        offset: offset,
      };

      if (sort.length > 0) {
        requestBody.sort = sort;
      }

      const response = await this.client.post('/v1/analytics/data', requestBody);

      return response.data;
    } catch (error: any) {
      if (error.response) {
        const errorMessage = error.response.data?.message || error.response.data?.error || error.response.statusText;
        throw new Error(`OZON API ошибка: ${errorMessage}`);
      }
      throw new Error('Ошибка подключения к OZON API');
    }
  }

  async getProductQueries(
    dateFrom: string,
    skus: string[],
    pageSize: number = 1000,
    page: number = 0,
    dateTo?: string,
    sortBy: 'BY_SEARCHES' | 'BY_VIEWS' | 'BY_POSITION' | 'BY_CONVERSION' | 'BY_GMV' = 'BY_SEARCHES',
    sortDir: 'DESCENDING' | 'ASCENDING' = 'DESCENDING'
  ): Promise<any> {
    if (!this.client) {
      await this.initialize();
      if (!this.client) {
        throw new Error('OZON API не настроен');
      }
    }

    if (skus.length > 1000) {
      throw new Error('Максимум 1000 SKU за один запрос');
    }

    try {
      const requestBody: any = {
        date_from: dateFrom,
        skus: skus,
        page_size: Math.min(Math.max(pageSize, 1), 1000),
        page: page,
        sort_by: sortBy,
        sort_dir: sortDir,
      };

      if (dateTo) {
        requestBody.date_to = dateTo;
      }

      const response = await this.client.post('/v1/analytics/product-queries', requestBody);

      return response.data;
    } catch (error: any) {
      if (error.response) {
        const errorMessage = error.response.data?.message || error.response.data?.error || error.response.statusText;
        throw new Error(`OZON API ошибка: ${errorMessage}`);
      }
      throw new Error('Ошибка подключения к OZON API');
    }
  }

  async getProductQueriesDetails(
    dateFrom: string,
    skus: string[],
    limitBySku: number,
    pageSize: number = 100,
    page: number = 0,
    dateTo?: string,
    sortBy: 'BY_SEARCHES' | 'BY_VIEWS' | 'BY_POSITION' | 'BY_CONVERSION' | 'BY_GMV' = 'BY_SEARCHES',
    sortDir: 'DESCENDING' | 'ASCENDING' = 'DESCENDING'
  ): Promise<any> {
    if (!this.client) {
      await this.initialize();
      if (!this.client) {
        throw new Error('OZON API не настроен');
      }
    }

    if (skus.length > 1000) {
      throw new Error('Максимум 1000 SKU за один запрос');
    }

    if (limitBySku > 15) {
      throw new Error('Максимум 15 запросов по одному SKU');
    }

    try {
      const requestBody: any = {
        date_from: dateFrom,
        skus: skus,
        limit_by_sku: limitBySku,
        page_size: Math.min(Math.max(pageSize, 1), 100),
        page: page,
        sort_by: sortBy,
        sort_dir: sortDir,
      };

      if (dateTo) {
        requestBody.date_to = dateTo;
      }

      const response = await this.client.post('/v1/analytics/product-queries/details', requestBody);

      return response.data;
    } catch (error: any) {
      if (error.response) {
        const errorMessage = error.response.data?.message || error.response.data?.error || error.response.statusText;
        throw new Error(`OZON API ошибка: ${errorMessage}`);
      }
      throw new Error('Ошибка подключения к OZON API');
    }
  }

  async getRealizationByDay(day: number, month: number, year: number): Promise<any> {
    if (!this.client) {
      await this.initialize();
      if (!this.client) {
        throw new Error('OZON API не настроен');
      }
    }

    try {
      const response = await this.client.post('/v1/finance/realization/by-day', {
        day: day,
        month: month,
        year: year,
      });

      return response.data;
    } catch (error: any) {
      if (error.response) {
        const errorMessage = error.response.data?.message || error.response.data?.error || error.response.statusText;
        throw new Error(`OZON API ошибка: ${errorMessage}`);
      }
      throw new Error('Ошибка подключения к OZON API');
    }
  }

  async searchQueriesByText(
    text: string,
    limit: number = 50,
    offset: number = 0,
    sortBy: 'SORT_BY_UNSPECIFIED' | 'CLIENT_COUNT' | 'ADD_TO_CART' | 'CONVERSION_TO_CART' | 'AVG_PRICE' = 'SORT_BY_UNSPECIFIED',
    sortDir: 'SORT_DIR_UNSPECIFIED' | 'ASC' | 'DESC' = 'SORT_DIR_UNSPECIFIED'
  ): Promise<any> {
    if (!this.client) {
      await this.initialize();
      if (!this.client) {
        throw new Error('OZON API не настроен');
      }
    }

    try {
      const response = await this.client.post('/v1/search-queries/text', {
        text: text,
        limit: Math.min(Math.max(parseInt(limit.toString()), 1), 50).toString(),
        offset: Math.min(Math.max(parseInt(offset.toString()), 0), 50).toString(),
        sort_by: sortBy,
        sort_dir: sortDir,
      });

      return response.data;
    } catch (error: any) {
      if (error.response) {
        const errorMessage = error.response.data?.message || error.response.data?.error || error.response.statusText;
        throw new Error(`OZON API ошибка: ${errorMessage}`);
      }
      throw new Error('Ошибка подключения к OZON API');
    }
  }

  async getTopSearchQueries(limit: number = 50, offset: number = 0): Promise<any> {
    if (!this.client) {
      await this.initialize();
      if (!this.client) {
        throw new Error('OZON API не настроен');
      }
    }

    try {
      const response = await this.client.post('/v1/search-queries/top', {
        limit: Math.min(Math.max(parseInt(limit.toString()), 1), 50).toString(),
        offset: Math.min(Math.max(parseInt(offset.toString()), 0), 1000).toString(),
      });

      return response.data;
    } catch (error: any) {
      if (error.response) {
        const errorMessage = error.response.data?.message || error.response.data?.error || error.response.statusText;
        throw new Error(`OZON API ошибка: ${errorMessage}`);
      }
      throw new Error('Ошибка подключения к OZON API');
    }
  }

  async sendFileToChat(chatId: string, base64Content: string, fileName: string): Promise<any> {
    if (!this.client) {
      await this.initialize();
      if (!this.client) {
        throw new Error('OZON API не настроен');
      }
    }

    try {
      const response = await this.client.post('/v1/chat/send/file', {
        chat_id: chatId,
        base64_content: base64Content,
        name: fileName,
      });

      return response.data;
    } catch (error: any) {
      if (error.response) {
        const errorMessage = error.response.data?.message || error.response.data?.error || error.response.statusText;
        throw new Error(`OZON API ошибка: ${errorMessage}`);
      }
      throw new Error('Ошибка подключения к OZON API');
    }
  }

  async getProductInfo(productId?: number, offerId?: string, sku?: number): Promise<any> {
    if (!this.client) {
      await this.initialize();
      if (!this.client) {
        throw new Error('OZON API не настроен');
      }
    }

    if (!productId && !offerId && !sku) {
      throw new Error('Необходимо указать product_id, offer_id или sku');
    }

    try {
      const params: any = {};
      if (productId) {
        params.product_id = productId;
      }
      if (offerId) {
        params.offer_id = offerId;
      }
      if (sku) {
        params.sku = sku;
      }

      // GET запрос согласно документации OZON API
      const response = await this.client.get('/v2/product/info', { params });

      return response.data;
    } catch (error: any) {
      if (error.response) {
        const errorMessage = error.response.data?.message || error.response.data?.error || error.response.statusText;
        throw new Error(`OZON API ошибка: ${errorMessage}`);
      }
      throw new Error('Ошибка подключения к OZON API');
    }
  }

  async getProductStocks(
    filter: {
      offer_id?: string[];
      product_id?: string[];
      visibility?: 'ALL' | 'VISIBLE' | 'INVISIBLE' | 'EMPTY_STOCK' | 'NOT_MODERATED' | 'MODERATED' | 'DISABLED' | 'STATE_FAILED' | 'READY_TO_SUPPLY' | 'VALIDATION_STATE_PENDING' | 'VALIDATION_STATE_FAIL' | 'VALIDATION_STATE_SUCCESS' | 'TO_SUPPLY' | 'IN_SALE' | 'REMOVED_FROM_SALE' | 'BANNED' | 'OVERPRICED' | 'CRITICALLY_OVERPRICED' | 'EMPTY_BARCODE' | 'BARCODE_EXISTS' | 'QUARANTINE' | 'ARCHIVED' | 'OVERPRICED_WITH_STOCK' | 'PARTIAL_APPROVED' | 'IMAGE_ABSENT' | 'MODERATION';
      with_quant?: {
        created?: boolean;
        exists?: boolean;
      };
    },
    limit: number = 1000,
    cursor?: string | null
  ): Promise<{
    items: Array<{
      product_id: number;
      offer_id: string;
      stocks: Array<{
        present: number;
        reserved: number;
        shipment_type?: string;
        sku?: number;
        type?: string;
        warehouse_ids?: number[];
      }>;
    }>;
    cursor: string | null;
    last_id?: string | null; // Для обратной совместимости
  }> {
    if (!this.client) {
      await this.initialize();
      if (!this.client) {
        throw new Error('OZON API не настроен');
      }
    }

    return retryWithDelay(async () => {
      try {
        const requestBody: any = {
          filter,
          limit: Math.min(Math.max(limit, 1), 1000),
        };

        // /v4/product/info/stocks использует cursor, а не last_id
        if (cursor && cursor !== '') {
          requestBody.cursor = cursor;
        }

        const response = await this.client!.post('/v4/product/info/stocks', requestBody);

        return {
          items: response.data.items || [],
          cursor: response.data.cursor || null,
          last_id: response.data.cursor || null, // Для обратной совместимости
        };
      } catch (error: any) {
        if (error.response) {
          const errorMessage = error.response.data?.message || error.response.data?.error || error.response.statusText;
          throw new Error(`OZON API ошибка: ${errorMessage}`);
        }
        throw new Error('Ошибка подключения к OZON API');
      }
    });
  }

  async getWarehouseStocks(
    warehouseId: number,
    limit: number = 100,
    cursor?: string
  ): Promise<any> {
    if (!this.client) {
      await this.initialize();
      if (!this.client) {
        throw new Error('OZON API не настроен');
      }
    }

    try {
      const requestBody: any = {
        warehouse_id: warehouseId,
        limit: Math.min(Math.max(limit, 1), 1000),
      };

      if (cursor) {
        requestBody.cursor = cursor;
      }

      const response = await this.client.post('/v1/product/info/warehouse/stocks', requestBody);

      return response.data;
    } catch (error: any) {
      if (error.response) {
        const errorMessage = error.response.data?.message || error.response.data?.error || error.response.statusText;
        throw new Error(`OZON API ошибка: ${errorMessage}`);
      }
      throw new Error('Ошибка подключения к OZON API');
    }
  }

  async updatePriceTimer(productIds: number[]): Promise<any> {
    if (!this.client) {
      await this.initialize();
      if (!this.client) {
        throw new Error('OZON API не настроен');
      }
    }

    if (!productIds || productIds.length === 0) {
      throw new Error('Список product_id обязателен');
    }

    if (productIds.length > 1000) {
      throw new Error('Максимум 1000 товаров за один запрос');
    }

    try {
      const response = await this.client.post('/v1/product/action/timer/update', {
        product_ids: productIds,
      });

      return response.data;
    } catch (error: any) {
      if (error.response) {
        const errorMessage = error.response.data?.message || error.response.data?.error || error.response.statusText;
        throw new Error(`OZON API ошибка: ${errorMessage}`);
      }
      throw new Error('Ошибка подключения к OZON API');
    }
  }

  async getProductInfoBatch(productIds?: number[], offerIds?: string[], skus?: number[]): Promise<any> {
    if (!this.client) {
      await this.initialize();
      if (!this.client) {
        throw new Error('OZON API не настроен');
      }
    }

    try {
      const params: any = {};
      
      if (productIds && productIds.length > 0) {
        params.product_id = productIds;
      }
      if (offerIds && offerIds.length > 0) {
        params.offer_id = offerIds;
      }
      if (skus && skus.length > 0) {
        params.sku = skus;
      }

      if (Object.keys(params).length === 0) {
        throw new Error('Необходимо указать хотя бы один product_id, offer_id или sku');
      }

      // GET запрос согласно документации OZON API
      const response = await this.client.get('/v2/product/info', {
        params: params,
      });

      return response.data;
    } catch (error: any) {
      if (error.response) {
        const errorMessage = error.response.data?.message || error.response.data?.error || error.response.statusText;
        throw new Error(`OZON API ошибка: ${errorMessage}`);
      }
      throw new Error('Ошибка подключения к OZON API');
    }
  }

  async getProductInfoList(productIds?: string[], offerIds?: string[], skus?: string[]): Promise<any> {
    if (!this.client) {
      await this.initialize();
      if (!this.client) {
        throw new Error('OZON API не настроен');
      }
    }

    return retryWithDelay(async () => {
      try {
        const requestBody: any = {};
        
        if (productIds && productIds.length > 0) {
          if (productIds.length > 1000) {
            throw new Error('Максимум 1000 product_id за один запрос');
          }
          requestBody.product_id = productIds;
        }
        if (offerIds && offerIds.length > 0) {
          if (offerIds.length > 1000) {
            throw new Error('Максимум 1000 offer_id за один запрос');
          }
          requestBody.offer_id = offerIds;
        }
        if (skus && skus.length > 0) {
          if (skus.length > 1000) {
            throw new Error('Максимум 1000 sku за один запрос');
          }
          requestBody.sku = skus;
        }

        // Проверяем общее количество идентификаторов
        const totalIds = (productIds?.length || 0) + (offerIds?.length || 0) + (skus?.length || 0);
        if (totalIds > 1000) {
          throw new Error('Максимум 1000 идентификаторов в сумме за один запрос');
        }

        if (Object.keys(requestBody).length === 0) {
          throw new Error('Необходимо указать хотя бы один product_id, offer_id или sku');
        }

        // POST запрос согласно документации OZON API /v3/product/info/list
        const response = await this.client!.post('/v3/product/info/list', requestBody);

        return response.data;
      } catch (error: any) {
        if (error.response) {
          const errorMessage = error.response.data?.message || error.response.data?.error || error.response.statusText;
          throw new Error(`OZON API ошибка: ${errorMessage}`);
        }
        throw new Error('Ошибка подключения к OZON API');
      }
    });
  }

  /**
   * Полная синхронизация товаров с параллельной загрузкой данных
   * Использует курсорную пагинацию для быстрой обработки большого количества товаров
   * 
   * @param onProgress - callback для отслеживания прогресса (current, total, stage)
   * @returns статистика синхронизации
   */
  async syncAllProducts(onProgress?: (current: number, total: number, stage: string) => void): Promise<{
    total: number;
    synced: number;
    errors: number;
    duration: number;
  }> {
    if (!this.client) {
      await this.initialize();
      if (!this.client) {
        throw new Error('OZON API не настроен');
      }
    }

    const startTime = Date.now();
    let totalProducts = 0;
    let syncedProducts = 0;
    let errorCount = 0;
    let lastId: string | null = null;
    let hasMore = true;

    // Этап 1: Получение списка всех товаров с базовой информацией
    const productsMap = new Map<string, any>();
    const productIds: string[] = [];
    const offerIds: string[] = [];

    onProgress?.(0, 0, 'Получение списка товаров...');

    while (hasMore) {
      try {
        const result: {
          items: any[];
          total: number;
          last_id: string | null;
        } = await this.getProductInfoListPaginated(lastId, 1000);
        const items = result.items || [];
        
        items.forEach((item: any) => {
          const productId = item.product_id?.toString();
          const offerId = item.offer_id?.toString();
          
          if (productId) {
            // Логируем структуру первого товара для отладки
            if (productsMap.size === 0) {
              logger.debug('Структура товара из /v3/product/list:', JSON.stringify(item, null, 2).substring(0, 1000));
            }

            productsMap.set(productId, {
              product_id: item.product_id,
              offer_id: offerId || '',
              sku: item.sku || 0,
              name: item.name || item.title || '',
              status: item.status || '',
              price: item.price || item.marketing_price || '0',
              old_price: item.old_price || null,
              currency_code: item.currency_code || 'RUB',
              created_at: item.created_at || '',
              updated_at: item.updated_at || '',
            });
            
            if (productId) productIds.push(productId);
            if (offerId) offerIds.push(offerId);
          }
        });

        totalProducts = result.total || productsMap.size;
        lastId = result.last_id;
        hasMore = !!lastId && items.length > 0;

        onProgress?.(productsMap.size, totalProducts, `Получено товаров: ${productsMap.size}/${totalProducts}`);

        // Небольшая задержка для избежания rate limit
        if (hasMore) {
          await delay(100);
        }
      } catch (error: any) {
        console.error('Ошибка при получении списка товаров:', error.message);
        errorCount++;
        // Продолжаем с последнего успешного last_id
        if (errorCount > 5) {
          throw new Error(`Слишком много ошибок при получении списка товаров: ${error.message}`);
        }
        await delay(1000);
      }
    }

    console.log(`Получено ${productsMap.size} товаров для синхронизации`);

    // Этап 2: Параллельная загрузка атрибутов (для названий), остатков и изображений
    // Цены уже получены из /v3/product/list, сохраняем их в pricesMap
    const pricesMap = new Map<string, any>();
    const attributesMap = new Map<string, any>();
    const stocksMap = new Map<string, any>();
    const imagesMap = new Map<string, string[]>();

    // Сохраняем цены из уже полученных товаров
    productsMap.forEach((product, productId) => {
      const offerId = product.offer_id;
      if (offerId) {
        pricesMap.set(offerId, {
          price: product.price || '0',
          old_price: product.old_price || null,
          currency_code: product.currency_code || 'RUB',
        });
      }
      if (productId) {
        pricesMap.set(productId, {
          price: product.price || '0',
          old_price: product.old_price || null,
          currency_code: product.currency_code || 'RUB',
        });
      }
    });

    // Загружаем атрибуты для получения полных названий товаров
    onProgress?.(0, totalProducts, 'Загрузка атрибутов товаров...');
    const attributesBatchSize = 1000;
    let attributesLoaded = 0;

    for (let i = 0; i < productIds.length; i += attributesBatchSize) {
      try {
        const batch = productIds.slice(i, i + attributesBatchSize).map(id => parseInt(id));
        const attributesResult = await this.getProductAttributes(
          { product_id: batch },
          undefined,
          Math.min(batch.length, 1000)
        );

        if (attributesResult.result && Array.isArray(attributesResult.result)) {
          attributesResult.result.forEach((attrItem: any) => {
            const productId = attrItem.id?.toString() || attrItem.product_id?.toString();
            if (productId) {
              attributesMap.set(productId, attrItem);
            }
          });
        }

        attributesLoaded += batch.length;
        onProgress?.(attributesLoaded, productIds.length, `Загружено атрибутов: ${attributesLoaded}/${productIds.length}`);

        if (i + attributesBatchSize < productIds.length) {
          await delay(200);
        }
      } catch (error: any) {
        console.error(`Ошибка при получении атрибутов для батча ${i}-${i + attributesBatchSize}:`, error.message);
      }
    }

    // Загружаем остатки через /v4/product/info/stocks с курсорной пагинацией
    onProgress?.(0, totalProducts, 'Загрузка остатков...');
    let stocksCursor: string | null = null;
    let hasMoreStocks = true;
    let stocksLoaded = 0;

    // Собираем все offer_id из товаров (уникальные)
    const offerIdList = Array.from(new Set(offerIds.filter(id => id && id.length > 0)));

    logger.debug(`Всего offer_id для загрузки остатков: ${offerIdList.length}`);

    // Загружаем остатки через курсорную пагинацию
    // Разбиваем offer_id на батчи по 1000 (максимум для фильтра)
    const stockBatchSize = 1000;
    for (let i = 0; i < offerIdList.length; i += stockBatchSize) {
      try {
        const batch = offerIdList.slice(i, i + stockBatchSize);
        stocksCursor = null; // Сбрасываем курсор для каждого батча
        hasMoreStocks = true;

        while (hasMoreStocks) {
          try {
            const stocksResult = await this.getProductStocks(
              { offer_id: batch },
              1000,
              stocksCursor
            );

            // Логируем структуру ответа для первого запроса
            if (i === 0 && stocksCursor === null) {
              logger.debug('Структура ответа остатков:', JSON.stringify(stocksResult, null, 2).substring(0, 1000));
            }

            // Обрабатываем результат согласно документации /v4/product/info/stocks
            // Структура: { items: [{ offer_id, product_id, stocks: [{ present, reserved, ... }] }] }
            if (stocksResult.items && Array.isArray(stocksResult.items)) {
              stocksResult.items.forEach((item: any) => {
                const offerId = item.offer_id?.toString();
                const productId = item.product_id?.toString();
                
                if (offerId || productId) {
                  // Сохраняем весь объект с массивом stocks
                  // Важно: сохраняем и по offer_id, и по product_id для надежности
                  if (offerId) {
                    stocksMap.set(offerId, item);
                  }
                  if (productId) {
                    stocksMap.set(productId, item);
                  }
                  
                  // Логируем первые несколько для отладки
                  if (stocksLoaded < 5) {
                    const totalPresent = item.stocks?.reduce((sum: number, s: any) => {
                      const present = s.present ?? 0;
                      return sum + (typeof present === 'number' ? present : parseFloat(String(present)) || 0);
                    }, 0) ?? 0;
                    const totalReserved = item.stocks?.reduce((sum: number, s: any) => {
                      const reserved = s.reserved ?? 0;
                      return sum + (typeof reserved === 'number' ? reserved : parseFloat(String(reserved)) || 0);
                    }, 0) ?? 0;
                    logger.debug(`Сохранены остатки для offer_id=${offerId}, product_id=${productId}:`, {
                      stocksCount: item.stocks?.length || 0,
                      totalPresent,
                      totalReserved,
                      sampleStock: item.stocks?.[0]
                    });
                  }
                }
              });
            } else {
              logger.debug(`Неожиданная структура ответа остатков:`, {
                hasItems: !!stocksResult.items,
                itemsType: typeof stocksResult.items,
                keys: Object.keys(stocksResult)
              });
            }

            stocksCursor = stocksResult.cursor || stocksResult.last_id || null;
            stocksLoaded += stocksResult.items?.length || 0;
            hasMoreStocks = !!stocksCursor && (stocksResult.items?.length || 0) > 0;

            onProgress?.(stocksLoaded, offerIdList.length, `Загружено остатков: ${stocksLoaded}/${offerIdList.length}`);

            // Небольшая задержка между запросами
            if (hasMoreStocks) {
              await delay(200);
            }
          } catch (error: any) {
            console.error(`Ошибка при получении остатков для батча ${i}:`, error.message);
            if (i === 0 && stocksCursor === null) {
              console.error('[DEBUG] Полная ошибка:', error);
            }
            hasMoreStocks = false; // Останавливаем при ошибке
          }
        }

        // Небольшая задержка между батчами
        if (i + stockBatchSize < offerIdList.length) {
          await delay(200);
        }
      } catch (error: any) {
        console.error(`Ошибка при обработке батча остатков ${i}-${i + stockBatchSize}:`, error.message);
      }
    }

    logger.debug(`Загружено остатков для ${stocksMap.size} товаров`);

    // Загружаем цены через /v5/product/info/prices с курсорной пагинацией
    onProgress?.(0, totalProducts, 'Загрузка цен...');
    let pricesCursor: string | null = null;
    let hasMorePrices = true;
    let pricesLoaded = 0;

    // Собираем все offer_id из товаров (уникальные)
    const offerIdListForPrices = Array.from(new Set(offerIds.filter(id => id && id.length > 0)));

    logger.debug(`Всего offer_id для загрузки цен: ${offerIdListForPrices.length}`);

    // Загружаем цены через курсорную пагинацию
    // Разбиваем offer_id на батчи по 1000 (максимум для фильтра)
    const priceBatchSize = 1000;
    for (let i = 0; i < offerIdListForPrices.length; i += priceBatchSize) {
      try {
        const batch = offerIdListForPrices.slice(i, i + priceBatchSize);
        pricesCursor = null; // Сбрасываем курсор для каждого батча
        hasMorePrices = true;

        while (hasMorePrices) {
          try {
            const pricesResult = await this.getProductPrices(
              { offer_id: batch },
              1000,
              pricesCursor
            );

            // Обрабатываем результат согласно документации /v5/product/info/prices
            // Структура: { items: [{ product_id, offer_id, price: { price, old_price, currency_code } }] }
            if (pricesResult.items && Array.isArray(pricesResult.items)) {
              pricesResult.items.forEach((item: any) => {
                const offerId = item.offer_id?.toString();
                const productId = item.product_id?.toString();
                
                if (offerId || productId) {
                  // Обновляем цены в pricesMap
                  const priceData = {
                    price: item.price || 0,
                    old_price: item.old_price || null,
                    currency_code: item.currency_code || 'RUB',
                  };
                  
                  if (offerId) {
                    pricesMap.set(offerId, priceData);
                  }
                  if (productId) {
                    pricesMap.set(productId, priceData);
                  }
                  
                  // Логируем первые несколько для отладки
                  if (pricesLoaded < 5) {
                    logger.debug(`Сохранены цены для offer_id=${offerId}, product_id=${productId}:`, {
                      price: priceData.price,
                      old_price: priceData.old_price,
                      currency: priceData.currency_code
                    });
                  }
                }
              });
            }

            pricesCursor = pricesResult.cursor || pricesResult.last_id || null;
            pricesLoaded += pricesResult.items?.length || 0;
            hasMorePrices = !!pricesCursor && (pricesResult.items?.length || 0) > 0;

            onProgress?.(pricesLoaded, offerIdListForPrices.length, `Загружено цен: ${pricesLoaded}/${offerIdListForPrices.length}`);

            // Небольшая задержка между запросами
            if (hasMorePrices) {
              await delay(200);
            }
          } catch (error: any) {
            console.error(`Ошибка при получении цен для батча ${i}:`, error.message);
            if (i === 0 && pricesCursor === null) {
              console.error('[DEBUG] Полная ошибка получения цен:', error);
            }
            hasMorePrices = false; // Останавливаем при ошибке
          }
        }

        // Небольшая задержка между батчами
        if (i + priceBatchSize < offerIdListForPrices.length) {
          await delay(200);
        }
      } catch (error: any) {
        console.error(`Ошибка при обработке батча цен ${i}-${i + priceBatchSize}:`, error.message);
      }
    }

    logger.debug(`Загружено цен для ${pricesMap.size} товаров`);

    // Загружаем изображения батчами по 1000
    onProgress?.(0, totalProducts, 'Загрузка изображений...');
    const imageBatchSize = 1000;
    let imagesLoaded = 0;

    for (let i = 0; i < productIds.length; i += imageBatchSize) {
      try {
        const batch = productIds.slice(i, i + imageBatchSize);
        const picturesResult = await this.getProductPictures(batch);
        
        // Логируем структуру ответа для первого батча
        if (i === 0) {
          logger.debug('Структура ответа изображений:', JSON.stringify(picturesResult, null, 2).substring(0, 500));
        }

        // Обрабатываем разные форматы ответа изображений
        // Структура может быть: { items: [...] } или { result: [...] }
        const picturesItems = picturesResult.items || picturesResult.result || [];
        
        if (Array.isArray(picturesItems) && picturesItems.length > 0) {
          picturesItems.forEach((picItem: any) => {
            const productId = picItem.product_id?.toString() || picItem.id?.toString();
            if (productId) {
              // Обрабатываем разные форматы изображений
              let imageUrls: string[] = [];
              
              // Формат: { primary_photo: ["url1", "url2", ...] } - массив строк URL (приоритет)
              if (picItem.primary_photo && Array.isArray(picItem.primary_photo) && picItem.primary_photo.length > 0) {
                imageUrls = picItem.primary_photo.map((img: any) => {
                  if (typeof img === 'string') return img;
                  return img.url || img.file_name || img;
                }).filter((url: string) => url && url.length > 0);
              }
              // Формат: { photo: [{ url: "...", ... }] или ["url1", ...] } - основной формат OZON
              else if (picItem.photo && Array.isArray(picItem.photo) && picItem.photo.length > 0) {
                imageUrls = picItem.photo.map((img: any) => {
                  if (typeof img === 'string') return img;
                  return img.url || img.file_name || img;
                }).filter((url: string) => url && url.length > 0);
              }
              // Формат: { images: [{ url: "...", ... }] }
              else if (picItem.images && Array.isArray(picItem.images) && picItem.images.length > 0) {
                imageUrls = picItem.images.map((img: any) => {
                  if (typeof img === 'string') return img;
                  return img.url || img.file_name || img;
                }).filter((url: string) => url && url.length > 0);
              }
              // Формат: массив строк напрямую
              else if (Array.isArray(picItem) && picItem.length > 0) {
                imageUrls = picItem.map((img: any) => {
                  if (typeof img === 'string') return img;
                  return img.url || img.file_name || img;
                }).filter((url: string) => url && url.length > 0);
              }
              
              if (imageUrls.length > 0) {
                imagesMap.set(productId, imageUrls);
              } else if (i === 0) {
                logger.debug(`Нет изображений для товара ${productId}:`, {
                  keys: Object.keys(picItem),
                  sample: JSON.stringify(picItem).substring(0, 300)
                });
              }
            }
          });
        } else if (i === 0) {
          logger.debug(`Неожиданная структура ответа изображений для батча ${i}:`, {
            keys: Object.keys(picturesResult),
            hasItems: !!picturesResult.items,
            hasResult: !!picturesResult.result,
            sample: JSON.stringify(picturesResult).substring(0, 500)
          });
        }

        imagesLoaded += batch.length;
        onProgress?.(imagesLoaded, totalProducts, `Загружено изображений: ${imagesLoaded}/${productIds.length}`);
        
        if (i + imageBatchSize < productIds.length) {
          await delay(100);
        }
      } catch (error: any) {
        console.error(`Ошибка при получении изображений для батча ${i}-${i + imageBatchSize}:`, error.message);
        // Продолжаем без изображений для этого батча
      }
    }

    // Этап 3: Объединение данных и сохранение в БД
    onProgress?.(0, totalProducts, 'Сохранение в базу данных...');
    
    const { OzonProduct } = await import('../models/OzonProduct');
    const bulkOps: any[] = [];
    let processed = 0;

    for (const [productId, product] of productsMap) {
      try {
        const offerId = product.offer_id;
        const priceData = pricesMap.get(offerId) || pricesMap.get(productId);
        
        // Получаем остатки из stocksMap - пробуем найти по offer_id, затем по product_id
        let stockData = stocksMap.get(offerId);
        if (!stockData && productId) {
          stockData = stocksMap.get(productId);
        }
        
        const attributes = attributesMap.get(productId);
        const images = imagesMap.get(productId) || [];

        // Получаем название из атрибутов (более полное) или из базовой информации
        const productName = attributes?.name || product.name || product.title || '';

        // Суммируем остатки по всем складам
        // Структура из /v4/product/info/stocks: { offer_id, product_id, stocks: [{ present, reserved, ... }] }
        let totalPresent = 0;
        let totalReserved = 0;
        
        if (stockData && stockData.stocks && Array.isArray(stockData.stocks)) {
          // Обрабатываем массив stocks из /v4/product/info/stocks
          // Суммируем present и reserved по всем складам и типам отгрузки
          stockData.stocks.forEach((stockItem: any) => {
            // Используем ?? вместо || чтобы не потерять значение 0
            const present = stockItem.present ?? 0;
            const reserved = stockItem.reserved ?? 0;
            
            // Правильно обрабатываем числа и строки
            const presentNum = typeof present === 'number' ? present : (present !== null && present !== undefined ? parseFloat(String(present)) : 0);
            const reservedNum = typeof reserved === 'number' ? reserved : (reserved !== null && reserved !== undefined ? parseFloat(String(reserved)) : 0);
            
            // Убеждаемся, что значения не NaN
            if (!isNaN(presentNum) && presentNum >= 0) {
              totalPresent += presentNum;
            }
            if (!isNaN(reservedNum) && reservedNum >= 0) {
              totalReserved += reservedNum;
            }
          });
          
          // Логируем для первых товаров для отладки
          if (processed < 5) {
            logger.debug(`Product ${productId} (offer: ${offerId}):`, {
              stocksCount: stockData.stocks.length,
              totalPresent,
              totalReserved,
              sampleStock: stockData.stocks[0],
              foundByOfferId: stocksMap.has(offerId),
              foundByProductId: stocksMap.has(productId),
              willSaveStock: {
                coming: 0,
                present: totalPresent,
                reserved: totalReserved
              }
            });
          }
        } else if (processed < 5) {
          logger.debug(`Product ${productId} (offer: ${offerId}): No stock data found`, {
            hasStockData: !!stockData,
            hasStocksArray: stockData?.stocks && Array.isArray(stockData.stocks),
            stockDataKeys: stockData ? Object.keys(stockData) : [],
            offerIdInMap: stocksMap.has(offerId),
            productIdInMap: stocksMap.has(productId),
            offerId: offerId,
            productId: productId
          });
        }

        // Получаем цену из priceData или из самого продукта
        // priceData может быть объектом с полем price или строкой
        let price = 0;
        let oldPrice: number | null = null;
        let currency = 'RUB';
        
        if (priceData) {
          if (typeof priceData === 'object') {
            // priceData.price может быть числом или строкой
            const priceValue = priceData.price ?? priceData.marketing_price ?? 0;
            price = typeof priceValue === 'number' ? priceValue : parseFloat(String(priceValue)) || 0;
            oldPrice = priceData.old_price ? (typeof priceData.old_price === 'number' ? priceData.old_price : parseFloat(String(priceData.old_price))) : null;
            currency = priceData.currency_code || priceData.currency || 'RUB';
          } else {
            price = parseFloat(String(priceData)) || 0;
          }
        } else if (product.price !== undefined && product.price !== null) {
          price = typeof product.price === 'number' ? product.price : parseFloat(String(product.price)) || 0;
        }
        
        if (!oldPrice && product.old_price !== undefined && product.old_price !== null) {
          oldPrice = typeof product.old_price === 'number' ? product.old_price : parseFloat(String(product.old_price)) || null;
        }
        
        if (!currency && product.currency_code) {
          currency = product.currency_code;
        }
        
        const primaryImage = images.length > 0 ? images[0] : null;

        // Логируем для первых товаров
        if (processed < 5) {
          logger.debug(`Сохранение товара ${productId}:`, {
            name: productName,
            price,
            oldPrice,
            imagesCount: images.length,
            primaryImage,
            totalPresent,
            totalReserved,
            stockToSave: {
              coming: 0,
              present: totalPresent,
              reserved: totalReserved
            },
            hasAttributes: !!attributes,
            priceData: priceData ? (typeof priceData === 'object' ? Object.keys(priceData) : priceData) : null,
            productPrice: product.price,
            images: images.slice(0, 3), // Первые 3 изображения для отладки
            hasStockData: !!stockData,
            stockDataStocksLength: stockData?.stocks?.length || 0,
            offerId: offerId,
            stockDataSample: stockData?.stocks?.[0] ? {
              present: stockData.stocks[0].present,
              reserved: stockData.stocks[0].reserved,
              type: stockData.stocks[0].type
            } : null
          });
        }
        
        // ВАЖНО: Проверяем, что totalPresent правильно вычислен
        if (processed < 10 && totalPresent > 0) {
          logger.debug(`Товар ${productId} будет сохранен с остатком ${totalPresent}`);
        }

        bulkOps.push({
          updateOne: {
            filter: { productId: parseInt(productId) },
            update: {
              $set: {
                productId: parseInt(productId),
                offerId: offerId || '',
                sku: product.sku || 0,
                name: productName,
                price: price,
                oldPrice: oldPrice,
                currency: currency,
                status: product.status || '',
                images: images,
                primaryImage: primaryImage,
                stock: {
                  coming: 0,
                  present: totalPresent,
                  reserved: totalReserved,
                },
                hasPrice: price > 0,
                hasStock: totalPresent > 0,
                createdAtOzon: product.created_at || '',
                updatedAtOzon: product.updated_at || '',
                syncedAt: new Date(),
              },
            },
            upsert: true,
          },
        });

        processed++;
        if (processed % 1000 === 0) {
          onProgress?.(processed, totalProducts, `Сохранено: ${processed}/${totalProducts}`);
        }
      } catch (error: any) {
        console.error(`Ошибка при обработке товара ${productId}:`, error.message);
        errorCount++;
      }
    }

    // Сохраняем батчами по 1000 операций
    const bulkBatchSize = 1000;
    for (let i = 0; i < bulkOps.length; i += bulkBatchSize) {
      try {
        const batch = bulkOps.slice(i, i + bulkBatchSize);
        const result = await OzonProduct.bulkWrite(batch, { ordered: false });
        
        // Логируем результат для первого батча
        if (i === 0) {
          logger.debug(`Результат bulkWrite для первого батча:`, {
            matchedCount: result.matchedCount,
            modifiedCount: result.modifiedCount,
            upsertedCount: result.upsertedCount,
            insertedCount: result.insertedCount,
            sampleOperation: batch[0] ? {
              filter: batch[0].updateOne?.filter,
              update: batch[0].updateOne?.update?.$set ? {
                productId: batch[0].updateOne.update.$set.productId,
                stock: batch[0].updateOne.update.$set.stock
              } : null
            } : null
          });
        }
        
        syncedProducts += batch.length;
        onProgress?.(syncedProducts, totalProducts, `Сохранено: ${syncedProducts}/${totalProducts}`);
        
        // Проверяем сохранение для первого батча - загружаем несколько товаров из БД
        if (i === 0 && batch.length > 0) {
          // Проверяем первые 5 товаров из батча, особенно те, у которых должны быть остатки
          for (let j = 0; j < Math.min(5, batch.length); j++) {
            const op = batch[j];
            if (op.updateOne?.filter?.productId) {
              const testProductId = op.updateOne.filter.productId;
              const expectedStock = op.updateOne.update?.$set?.stock;
              const expectedPresent = expectedStock?.present ?? 0;
              
              // Ждем немного, чтобы БД успела обновиться
              await new Promise(resolve => setTimeout(resolve, 100));
              
              const savedProduct = await OzonProduct.findOne({ productId: testProductId }).lean();
              if (savedProduct) {
                const savedPresent = savedProduct.stock?.present ?? 0;
                const matches = savedPresent === expectedPresent;
                
                console.log(`[DEBUG] Проверка сохранения товара ${testProductId} в БД:`, {
                  savedStock: savedProduct.stock,
                  savedStockType: typeof savedProduct.stock,
                  savedStockPresent: savedPresent,
                  expectedStock: expectedStock,
                  expectedPresent: expectedPresent,
                  matches: matches,
                  hasStock: savedProduct.hasStock,
                  name: savedProduct.name,
                  syncedAt: savedProduct.syncedAt
                });
                
                // Если остатки не совпадают, пытаемся обновить вручную
                if (!matches && expectedPresent > 0) {
                  logger.debug(`ВНИМАНИЕ: Остатки не совпадают для товара ${testProductId}! Пытаемся исправить...`);
                  await OzonProduct.updateOne(
                    { productId: testProductId },
                    { 
                      $set: { 
                        stock: expectedStock,
                        hasStock: expectedPresent > 0
                      } 
                    }
                  );
                  logger.debug(`Товар ${testProductId} обновлен вручную`);
                }
              } else {
                logger.debug(`Товар ${testProductId} не найден в БД после сохранения`);
              }
            }
          }
        }
      } catch (error: any) {
        const batch = bulkOps.slice(i, i + bulkBatchSize);
        console.error(`Ошибка при сохранении батча ${i}-${i + bulkBatchSize}:`, error.message);
        errorCount += batch.length;
      }
    }

    const duration = Math.round((Date.now() - startTime) / 1000);

    onProgress?.(syncedProducts, totalProducts, 'Синхронизация завершена');

    return {
      total: totalProducts,
      synced: syncedProducts,
      errors: errorCount,
      duration,
    };
  }
}

export default new OzonService();

