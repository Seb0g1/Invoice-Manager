import axios, { AxiosInstance, AxiosError } from 'axios';
import OzonConfig from '../models/OzonConfig';

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

    try {
      const response = await this.client.post('/v2/product/pictures/info', {
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
        filter,
        limit: Math.min(Math.max(limit, 1), 1000),
      };

      if (cursor) {
        requestBody.cursor = cursor;
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
}

export default new OzonService();

