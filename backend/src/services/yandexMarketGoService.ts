import axios, { AxiosInstance } from 'axios';
import { YandexBusiness } from '../models/YandexBusiness';

interface YandexApiResponse<T> {
  status?: string;
  result?: T;
  errors?: Array<{ code: string; message: string }>;
}

interface CampaignOffer {
  offerId: string; // SKU - идентификатор товара
  available?: boolean;
  basicPrice?: {
    value?: number;
    currencyId?: string;
    discountBase?: number;
    updatedAt?: string;
  };
  campaignPrice?: {
    value?: number;
    currencyId?: string;
    discountBase?: number;
    vat?: number;
    updatedAt?: string;
  };
  status?: string;
  errors?: Array<{
    message?: string;
    comment?: string;
  }>;
  warnings?: Array<{
    message?: string;
    comment?: string;
  }>;
}

interface CampaignOffersResponse {
  status: string;
  result?: {
    offers?: CampaignOffer[];
    paging?: {
      nextPageToken?: string;
      prevPageToken?: string;
    };
  };
}

interface Campaign {
  id: number;
  domain?: string;
  name?: string;
}

interface CampaignsResponse {
  campaigns?: Campaign[];
}

// Старая структура для обратной совместимости
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
  pricing?: {
    value?: string;
    currencyId?: string;
  };
  parameters?: Array<{
    name: string;
    value: string;
  }>;
}

interface OfferMappingsResponse {
  result: {
    offerMappings?: OfferMapping[];
    paging?: {
      nextPageToken?: string;
      pageToken?: string;
    };
  };
}

interface StockItem {
  offerId: string;
  sku: number;
  items: Array<{
    type: string;
    count: number;
    updatedAt?: string;
  }>;
}

interface StocksResponse {
  result: {
    skus?: StockItem[];
    items?: StockItem[];
  };
}

// Интерфейсы для offer-cards API
interface OfferCardDTO {
  offerId: string;
  mapping?: {
    marketSku?: number;
    marketSkuName?: string;
    marketCategoryId?: number;
    marketCategoryName?: string;
    marketModelName?: string;
  };
  parameterValues?: Array<{
    parameterId: number;
    value?: string;
    valueId?: number;
  }>;
  pictures?: string[]; // Изображения товара
  photo?: {
    width?: number;
    height?: number;
    url?: string;
  };
  photos?: Array<{
    width?: number;
    height?: number;
    url?: string;
  }>;
}

interface OfferCardsResponse {
  status: string;
  result?: {
    offerCards?: OfferCardDTO[];
    paging?: {
      nextPageToken?: string;
    };
  };
}

// Интерфейсы для stocks API (новый формат)
interface WarehouseOfferDTO {
  offerId: string;
  stocks: Array<{
    count: number;
    type: string;
  }>;
  updatedAt?: string;
}

interface WarehouseOffersDTO {
  warehouseId: number;
  offers: WarehouseOfferDTO[];
}

interface WarehouseStocksResponse {
  status: string;
  result?: {
    warehouses?: WarehouseOffersDTO[];
    paging?: {
      nextPageToken?: string;
    };
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
    offers?: PriceItem[];
    paging?: {
      nextPageToken?: string;
      pageToken?: string;
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

interface UpdateOfferMappingRequest {
  offerId: string;
  name?: string;
  description?: string;
  language?: string;
}

class YandexMarketGoService {
  private clients: Map<string, AxiosInstance> = new Map();
  private refreshingTokens: Set<string> = new Set(); // Защита от параллельных обновлений

  /**
   * Обновить токен через refreshToken (если используется OAuth)
   */
  private async refreshToken(businessId: string): Promise<boolean> {
    // Защита от параллельных обновлений
    if (this.refreshingTokens.has(businessId)) {
      // Ждем завершения другого процесса обновления
      let attempts = 0;
      while (this.refreshingTokens.has(businessId) && attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;
      }
      return true;
    }

    this.refreshingTokens.add(businessId);

    try {
      const business = await YandexBusiness.findOne({ businessId });
      if (!business || !business.refreshToken) {
        console.warn(`[YandexMarketGo] RefreshToken для бизнеса ${businessId} не найден`);
        return false;
      }

      // Для Market Yandex Go используется Api-Key, который не требует обновления
      // Если в будущем будет использоваться OAuth, здесь будет запрос к OAuth endpoint
      // Пример: POST https://oauth.yandex.ru/token с refreshToken
      
      // Пока что просто обновляем время истечения, если токен был обновлен вручную
      // В будущем здесь будет реальный OAuth refresh
      console.log(`[YandexMarketGo] Обновление токена для бизнеса ${businessId} (требует ручного обновления Api-Key)`);
      
      return true;
    } catch (error: any) {
      console.error(`[YandexMarketGo] Ошибка обновления токена для бизнеса ${businessId}:`, error.message);
      return false;
    } finally {
      this.refreshingTokens.delete(businessId);
    }
  }

  /**
   * Получить клиент для работы с API конкретного бизнеса
   */
  async getClient(businessId: string): Promise<AxiosInstance | null> {
    // Проверяем кэш клиента
    if (this.clients.has(businessId)) {
      const cachedClient = this.clients.get(businessId)!;
      return cachedClient;
    }

    // Загружаем бизнес из БД
    const business = await YandexBusiness.findOne({ businessId, enabled: true });
    if (!business || !business.accessToken) {
      console.error(`[YandexMarketGo] Бизнес ${businessId} не найден или не настроен`);
      return null;
    }

    // Проверяем и обновляем токен, если он истек
    if (business.tokenExpiresAt && business.tokenExpiresAt < new Date()) {
      console.warn(`[YandexMarketGo] Токен для бизнеса ${businessId} истек, попытка обновления...`);
      const refreshed = await this.refreshToken(businessId);
      if (!refreshed) {
        console.error(`[YandexMarketGo] Не удалось обновить токен для бизнеса ${businessId}. Требуется ручное обновление Api-Key.`);
        // Продолжаем работу со старым токеном, возможно он все еще валиден
      }
    }

    // Создаем клиент для Market Yandex Go
    const client = axios.create({
      baseURL: 'https://api.partner.market.yandex.ru',
      headers: {
        'Api-Key': business.accessToken,
        'Content-Type': 'application/json',
      },
      timeout: 60000, // Увеличенный таймаут для больших запросов
    });

    // Добавляем обработчик ошибок с автоматическим обновлением токена
    client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401 || error.response?.status === 403) {
          // Api-Key невалиден или истек
          this.clients.delete(businessId);
          
          // Пытаемся обновить токен, если есть refreshToken
          const business = await YandexBusiness.findOne({ businessId });
          if (business?.refreshToken) {
            console.log(`[YandexMarketGo] Попытка обновления токена для бизнеса ${businessId} после 401/403 ошибки...`);
            const refreshed = await this.refreshToken(businessId);
            if (refreshed) {
              // Повторяем запрос с новым токеном (если токен был обновлен)
              // В текущей реализации Api-Key не обновляется автоматически
              console.warn(`[YandexMarketGo] Требуется ручное обновление Api-Key для бизнеса ${businessId}`);
            }
          }
          
          const errorMessage = error.response?.data?.errors?.[0]?.message || 
                              error.response?.data?.message || 
                              error.message || 
                              'Неизвестная ошибка';
          console.error(`[YandexMarketGo] Api-Key для бизнеса ${businessId} невалиден: ${errorMessage}`);
        }
        return Promise.reject(error);
      }
    );

    this.clients.set(businessId, client);
    return client;
  }

  /**
   * Получить campaignId для бизнеса
   */
  async getCampaignId(businessId: string): Promise<string | null> {
    const client = await this.getClient(businessId);
    if (!client) {
      return null;
    }

    try {
      // Пробуем получить список кампаний
      const response = await client.get<CampaignsResponse>('/v2/campaigns');
      if (response.data && response.data.campaigns && response.data.campaigns.length > 0) {
        const campaignId = response.data.campaigns[0].id?.toString();
        if (campaignId) {
          console.log(`[YandexMarketGo] Найден campaignId: ${campaignId} для бизнеса ${businessId}`);
          return campaignId;
        }
      }
    } catch (error: any) {
      console.warn(`[YandexMarketGo] Не удалось получить campaignId для бизнеса ${businessId}, используем businessId:`, error.message);
      console.warn(`[YandexMarketGo] Ответ от /v2/campaigns:`, error.response?.data);
    }

    // Если не удалось получить, используем businessId как campaignId
    return businessId;
  }

  /**
   * Получить все офферы бизнеса с пагинацией
   * Использует POST /v2/campaigns/{campaignId}/offers (правильный endpoint по документации)
   */
  async getOfferMappings(
    businessId: string,
    onProgress?: (current: number, total: number, stage: string) => void,
    maxOffers?: number // Лимит на количество офферов
  ): Promise<OfferMapping[]> {
    const client = await this.getClient(businessId);
    if (!client) {
      throw new Error(`Бизнес ${businessId} не настроен`);
    }

    // Получаем campaignId
    const campaignId = await this.getCampaignId(businessId);
    if (!campaignId) {
      throw new Error(`Не удалось получить campaignId для бизнеса ${businessId}`);
    }

    console.log(`[YandexMarketGo] Используем campaignId: ${campaignId} для бизнеса ${businessId}`);

    const allOffers: OfferMapping[] = [];
    let nextPageToken: string | undefined = undefined;
    let page = 0;

    onProgress?.(0, 0, 'Загрузка офферов...');

    const maxPages = 100000; // Защита от бесконечного цикла - максимум 100000 страниц
    const maxOffersLimit = maxOffers || 1000000; // По умолчанию лимит 1,000,000 товаров (практически без ограничений)
    let pagesProcessed = 0;

    while (pagesProcessed < maxPages && allOffers.length < maxOffersLimit) {
      try {
        const requestBody: any = {
          limit: 200, // Рекомендуемый размер батча
        };

        if (nextPageToken) {
          requestBody.page_token = nextPageToken;
        }

        // Логируем запрос для отладки
        if (page === 0) {
          console.log(`[YandexMarketGo] Первый запрос для бизнеса ${businessId}, лимит: ${maxOffersLimit}`);
        }

        // Используем правильный endpoint POST /v2/campaigns/{campaignId}/offers
        // campaignId = businessId (связаны один к одному)
        // Параметры limit и page_token передаются в query, body может быть пустым или содержать фильтры
        let response;
        try {
          // Пробуем новый правильный endpoint
          const queryParams: any = {};
          if (requestBody.limit) {
            queryParams.limit = requestBody.limit;
          }
          if (requestBody.page_token) {
            queryParams.page_token = requestBody.page_token;
          }
          
          response = await client.post<CampaignOffersResponse>(
            `/v2/campaigns/${campaignId}/offers`,
            {}, // Пустое тело, фильтры можно добавить позже
            {
              params: queryParams
            }
          );
        } catch (newEndpointError: any) {
          // Логируем детали ошибки
          console.error(`[YandexMarketGo] Ошибка при запросе к /v2/campaigns/${campaignId}/offers:`, {
            status: newEndpointError.response?.status,
            statusText: newEndpointError.response?.statusText,
            data: newEndpointError.response?.data,
            message: newEndpointError.message,
          });
          
          // Если новый endpoint не работает, пробуем старые варианты
          console.warn(`[YandexMarketGo] Новый endpoint не работает, пробуем старые...`);
            try {
              // Используем search endpoint, который возвращает больше информации включая pictures
              response = await client.post<OfferMappingsResponse>(
                `/v2/businesses/${businessId}/offer-mappings/search`,
                {
                  ...requestBody,
                  // Добавляем поля для получения изображений
                  // В некоторых версиях API можно указать какие поля нужны
                }
              );
          } catch (searchError: any) {
            console.error(`[YandexMarketGo] Ошибка при запросе к /v2/businesses/${businessId}/offer-mappings/search:`, {
              status: searchError.response?.status,
              statusText: searchError.response?.statusText,
              data: searchError.response?.data,
              message: searchError.message,
            });
            
            if (searchError.response?.status === 404 || searchError.response?.status === 405) {
              try {
                response = await client.post<OfferMappingsResponse>(
                  `/v2/businesses/${businessId}/offer-mappings`,
                  requestBody
                );
              } catch (oldError: any) {
                console.error(`[YandexMarketGo] Ошибка при запросе к /v2/businesses/${businessId}/offer-mappings:`, {
                  status: oldError.response?.status,
                  statusText: oldError.response?.statusText,
                  data: oldError.response?.data,
                  message: oldError.message,
                });
                throw new Error(`Не удалось получить офферы: ${oldError.response?.data?.errors?.[0]?.message || oldError.message}`);
              }
            } else {
              throw new Error(`Не удалось получить офферы: ${searchError.response?.data?.errors?.[0]?.message || searchError.message}`);
            }
          }
        }

        // Проверяем структуру ответа
        if (!response.data) {
          console.error(`[YandexMarketGo] Пустой ответ для бизнеса ${businessId}`);
          break;
        }

        // Проверяем, какой формат ответа пришел
        const isNewFormat = 'status' in response.data && 'result' in response.data;
        const isOldFormat = 'result' in response.data && 'offerMappings' in (response.data.result || {});
        
        // Логируем структуру ответа для первой страницы
        if (page === 0) {
          console.log(`[YandexMarketGo] Структура ответа для бизнеса ${businessId}:`, JSON.stringify({
            isNewFormat,
            isOldFormat,
            hasResult: !!response.data.result,
            hasOffers: !!(response.data as CampaignOffersResponse).result?.offers,
            hasOfferMappings: !!(response.data as OfferMappingsResponse).result?.offerMappings,
            offersCount: (response.data as CampaignOffersResponse).result?.offers?.length || 0,
            offerMappingsCount: (response.data as OfferMappingsResponse).result?.offerMappings?.length || 0,
            hasPaging: !!response.data.result?.paging,
          }, null, 2));
          
          // Логируем полную структуру первого оффера
          if (isNewFormat && (response.data as CampaignOffersResponse).result?.offers?.length) {
            const firstOffer = (response.data as CampaignOffersResponse).result!.offers![0];
            console.log(`[YandexMarketGo] Полная структура первого оффера (новый формат):`, JSON.stringify(firstOffer, null, 2));
            console.log(`[YandexMarketGo] Проверка изображений в новом формате:`, {
              hasPictures: 'pictures' in firstOffer,
              pictures: (firstOffer as any).pictures,
            });
          } else if (isOldFormat && (response.data as OfferMappingsResponse).result?.offerMappings?.length) {
            const firstMapping = (response.data as OfferMappingsResponse).result!.offerMappings![0];
            console.log(`[YandexMarketGo] Полная структура первого оффера (старый формат):`, JSON.stringify(firstMapping, null, 2));
            console.log(`[YandexMarketGo] Проверка изображений в старом формате:`, {
              hasPictures: !!firstMapping.pictures,
              picturesCount: firstMapping.pictures?.length || 0,
              pictures: firstMapping.pictures?.slice(0, 3),
            });
          }
        }

        // Обрабатываем новый формат ответа
        if (isNewFormat) {
          const campaignResponse = response.data as CampaignOffersResponse;
          if (campaignResponse.status !== 'OK') {
            console.error(`[YandexMarketGo] Ошибка в ответе: ${campaignResponse.status}`);
            break;
          }
          
          if (!campaignResponse.result || !campaignResponse.result.offers) {
            console.log(`[YandexMarketGo] Нет офферов в ответе для бизнеса ${businessId}`);
            break;
          }

          const newOffers = campaignResponse.result.offers;
          
          // Преобразуем в старый формат для совместимости
          const convertedOffers: OfferMapping[] = newOffers.map(offer => ({
            offerId: offer.offerId,
            vendorCode: offer.offerId, // В новом API offerId = SKU = vendorCode
            name: '', // В новом API нет названия в этом endpoint
            status: offer.status,
            pricing: offer.campaignPrice ? {
              value: offer.campaignPrice.value?.toString() || offer.basicPrice?.value?.toString(),
              currencyId: offer.campaignPrice.currencyId || offer.basicPrice?.currencyId,
            } : offer.basicPrice ? {
              value: offer.basicPrice.value?.toString(),
              currencyId: offer.basicPrice.currencyId,
            } : undefined,
            availability: offer.available ? 'ACTIVE' : 'INACTIVE',
          }));

          if (convertedOffers.length > 0) {
            console.log(`[YandexMarketGo] Получено ${convertedOffers.length} офферов на странице ${page + 1} для бизнеса ${businessId}`);
            
            // Если достигли лимита, берем только нужное количество
            if (allOffers.length + convertedOffers.length > maxOffersLimit) {
              const remaining = maxOffersLimit - allOffers.length;
              allOffers.push(...convertedOffers.slice(0, remaining));
              onProgress?.(allOffers.length, maxOffersLimit, `Загружено офферов: ${allOffers.length} (лимит: ${maxOffersLimit})...`);
              console.warn(`[YandexMarketGo] Достигнут лимит товаров (${maxOffersLimit}) для бизнеса ${businessId}`);
              break;
            }
            
            allOffers.push(...convertedOffers);
            onProgress?.(allOffers.length, maxOffersLimit, `Загружено офферов: ${allOffers.length}...`);

            nextPageToken = campaignResponse.result.paging?.nextPageToken;
            pagesProcessed++;
            page++;

            if (!nextPageToken || page >= maxPages || allOffers.length >= maxOffersLimit) {
              if (page >= maxPages) {
                console.warn(`[YandexMarketGo] Достигнут лимит страниц (${maxPages}) для бизнеса ${businessId}`);
              }
              if (allOffers.length >= maxOffersLimit) {
                console.warn(`[YandexMarketGo] Достигнут лимит товаров (${maxOffersLimit}) для бизнеса ${businessId}`);
              }
              break;
            }

            // Небольшая задержка между запросами
            await new Promise(resolve => setTimeout(resolve, 200));
            continue;
          } else {
            console.log(`[YandexMarketGo] Нет офферов на странице ${page + 1} для бизнеса ${businessId}, завершение`);
            break;
          }
        }

        // Обрабатываем старый формат ответа
        if (!response.data.result) {
          console.error(`[YandexMarketGo] Нет поля result в ответе для бизнеса ${businessId}:`, JSON.stringify(response.data, null, 2));
          break;
        }

        if ((response.data as OfferMappingsResponse).result?.offerMappings && (response.data as OfferMappingsResponse).result!.offerMappings!.length > 0) {
          const newOffers = (response.data as OfferMappingsResponse).result!.offerMappings!;
          console.log(`[YandexMarketGo] Получено ${newOffers.length} офферов на странице ${page + 1} для бизнеса ${businessId}`);
          
          // Если достигли лимита, берем только нужное количество
          if (allOffers.length + newOffers.length > maxOffersLimit) {
            const remaining = maxOffersLimit - allOffers.length;
            allOffers.push(...newOffers.slice(0, remaining));
            onProgress?.(allOffers.length, maxOffersLimit, `Загружено офферов: ${allOffers.length} (лимит: ${maxOffersLimit})...`);
            console.warn(`[YandexMarketGo] Достигнут лимит товаров (${maxOffersLimit}) для бизнеса ${businessId}`);
            break;
          }
          
          allOffers.push(...newOffers);
          onProgress?.(allOffers.length, maxOffersLimit, `Загружено офферов: ${allOffers.length}...`);

          const oldPaging = response.data.result.paging as any;
          nextPageToken = oldPaging?.nextPageToken || oldPaging?.pageToken;
          pagesProcessed++;
          page++;

          if (!nextPageToken || page >= maxPages || allOffers.length >= maxOffersLimit) {
            if (page >= maxPages) {
              console.warn(`[YandexMarketGo] Достигнут лимит страниц (${maxPages}) для бизнеса ${businessId}`);
            }
            if (allOffers.length >= maxOffersLimit) {
              console.warn(`[YandexMarketGo] Достигнут лимит товаров (${maxOffersLimit}) для бизнеса ${businessId}`);
            }
            break;
          }

          // Небольшая задержка между запросами
          await new Promise(resolve => setTimeout(resolve, 200));
        } else {
          // Если нет офферов, но есть nextPageToken, продолжаем
          const oldPaging = response.data.result.paging as any;
          if (oldPaging?.nextPageToken || oldPaging?.pageToken) {
            nextPageToken = oldPaging?.nextPageToken || oldPaging?.pageToken;
            pagesProcessed++;
            page++;
            await new Promise(resolve => setTimeout(resolve, 200));
            continue;
          }
          console.log(`[YandexMarketGo] Нет офферов на странице ${page + 1} для бизнеса ${businessId}, завершение`);
          break;
        }
      } catch (error: any) {
        console.error(`[YandexMarketGo] Ошибка получения офферов для бизнеса ${businessId}, страница ${page}:`, error.message);
        console.error(`[YandexMarketGo] URL: /v2/businesses/${businessId}/offer-mappings/search`);
        console.error(`[YandexMarketGo] Response status: ${error.response?.status}`);
        console.error(`[YandexMarketGo] Response data:`, error.response?.data);
        
        if (error.response?.status === 429) {
          // Rate limit, ждем и повторяем
          console.log('[YandexMarketGo] Rate limit, ожидание 5 секунд...');
          await new Promise(resolve => setTimeout(resolve, 5000));
          continue;
        }
        
        throw new Error(`Ошибка получения офферов: ${error.response?.data?.errors?.[0]?.message || error.response?.data?.message || error.message}`);
      }
    }

    console.log(`[YandexMarketGo] Всего загружено ${allOffers.length} офферов для бизнеса ${businessId}`);
    return allOffers;
  }

  /**
   * Тест подключения к API - делает только один запрос для проверки доступности
   */
  async testConnection(businessId: string): Promise<{ success: boolean; offersCount?: number; message?: string }> {
    const client = await this.getClient(businessId);
    if (!client) {
      return { success: false, message: 'Бизнес не настроен' };
    }

    try {
      // Делаем только один запрос с минимальным лимитом для быстрой проверки
      const requestBody: any = {
        limit: 1, // Минимальный лимит для быстрой проверки
      };

      let response;
      try {
        response = await client.post<OfferMappingsResponse>(
          `/v2/businesses/${businessId}/offer-mappings/search`,
          requestBody,
          { timeout: 10000 } // Таймаут 10 секунд для теста
        );
      } catch (searchError: any) {
        // Если /search не поддерживается, пробуем обычный эндпоинт
        if (searchError.response?.status === 404 || searchError.response?.status === 405) {
          response = await client.post<OfferMappingsResponse>(
            `/v2/businesses/${businessId}/offer-mappings`,
            requestBody,
            { timeout: 10000 }
          );
        } else {
          throw searchError;
        }
      }

      // Проверяем, что получили ответ
      if (response.data && response.data.result) {
        const offersCount = response.data.result.offerMappings?.length || 0;
        return {
          success: true,
          offersCount,
          message: 'Подключение успешно',
        };
      }

      return {
        success: true,
        offersCount: 0,
        message: 'Подключение успешно, но офферы не найдены',
      };
    } catch (error: any) {
      const errorMessage = error.response?.data?.errors?.[0]?.message || 
                          error.response?.data?.message || 
                          error.message || 
                          'Неизвестная ошибка';
      
      return {
        success: false,
        message: `Ошибка подключения: ${errorMessage}`,
      };
    }
  }

  /**
   * Получить информацию о карточках товаров (название, изображения и т.д.)
   * Использует POST /v2/businesses/{businessId}/offer-cards
   */
  async getOfferCards(
    businessId: string,
    offerIds?: string[],
    onProgress?: (current: number, total: number, stage: string) => void
  ): Promise<Map<string, OfferCardDTO>> {
    const client = await this.getClient(businessId);
    if (!client) {
      throw new Error(`Бизнес ${businessId} не настроен`);
    }

    const offerCardsMap = new Map<string, OfferCardDTO>();
    let nextPageToken: string | undefined = undefined;
    let page = 0;
    const maxPages = 10000;
    let pagesProcessed = 0;

    onProgress?.(0, 0, 'Загрузка информации о карточках...');

    try {
      while (pagesProcessed < maxPages) {
        const requestBody: any = {
          limit: 200,
        };

        if (nextPageToken) {
          requestBody.page_token = nextPageToken;
        }

        if (offerIds && offerIds.length > 0 && page === 0) {
          // Если указаны offerIds, отправляем их батчами (максимум 200 за раз)
          const batchSize = 200;
          for (let i = 0; i < offerIds.length; i += batchSize) {
            const batch = offerIds.slice(i, i + batchSize);
            requestBody.offerIds = batch;

            const response: { data: OfferCardsResponse } = await client.post<OfferCardsResponse>(
              `/v2/businesses/${businessId}/offer-cards`,
              requestBody,
              {
                params: {
                  limit: 200,
                }
              }
            );

            if (response.data.status === 'OK' && response.data.result?.offerCards) {
              response.data.result.offerCards.forEach((card: OfferCardDTO) => {
                offerCardsMap.set(card.offerId, card);
                // Логируем структуру первой карточки для отладки
                if (offerCardsMap.size === 1) {
                  console.log(`[YandexMarketGo] Структура первой offer-card:`, JSON.stringify({
                    offerId: card.offerId,
                    hasPictures: !!card.pictures,
                    picturesCount: card.pictures?.length || 0,
                    hasPhoto: !!card.photo,
                    hasPhotos: !!card.photos,
                    photosCount: card.photos?.length || 0,
                    samplePictures: card.pictures?.slice(0, 2),
                    samplePhoto: card.photo ? { url: card.photo.url, width: card.photo.width, height: card.photo.height } : null,
                    samplePhotos: card.photos?.slice(0, 2).map((p: any) => ({ url: p.url, width: p.width, height: p.height })),
                  }, null, 2));
                }
              });
              onProgress?.(offerCardsMap.size, offerIds.length, `Загружено карточек: ${offerCardsMap.size}...`);
            }

            // Задержка между батчами
            if (i + batchSize < offerIds.length) {
              await new Promise(resolve => setTimeout(resolve, 300));
            }
          }
          break; // Для offerIds не используем пагинацию
        } else {
          // Получаем все карточки с пагинацией
          const response: { data: OfferCardsResponse } = await client.post<OfferCardsResponse>(
            `/v2/businesses/${businessId}/offer-cards`,
            requestBody,
            {
              params: {
                limit: 200,
                ...(nextPageToken ? { page_token: nextPageToken } : {}),
              }
            }
          );

          if (response.data.status === 'OK' && response.data.result?.offerCards) {
            response.data.result.offerCards.forEach((card: OfferCardDTO) => {
              offerCardsMap.set(card.offerId, card);
              // Логируем структуру первой карточки для отладки
              if (offerCardsMap.size === 1) {
                console.log(`[YandexMarketGo] Структура первой offer-card (без offerIds):`, JSON.stringify({
                  offerId: card.offerId,
                  hasPictures: !!card.pictures,
                  picturesCount: card.pictures?.length || 0,
                  hasPhoto: !!card.photo,
                  hasPhotos: !!card.photos,
                  photosCount: card.photos?.length || 0,
                  samplePictures: card.pictures?.slice(0, 2),
                  samplePhoto: card.photo ? { url: card.photo.url, width: card.photo.width, height: card.photo.height } : null,
                  samplePhotos: card.photos?.slice(0, 2).map(p => ({ url: p.url, width: p.width, height: p.height })),
                }, null, 2));
              }
            });
            onProgress?.(offerCardsMap.size, offerCardsMap.size, `Загружено карточек: ${offerCardsMap.size}...`);

            nextPageToken = response.data.result.paging?.nextPageToken;
            pagesProcessed++;
            page++;

            if (!nextPageToken || pagesProcessed >= maxPages) {
              break;
            }

            await new Promise(resolve => setTimeout(resolve, 200));
          } else {
            break;
          }
        }
      }
    } catch (error: any) {
      console.error(`[YandexMarketGo] Ошибка получения карточек для бизнеса ${businessId}:`, error.message);
      console.error(`[YandexMarketGo] Response:`, error.response?.data);
      // Не бросаем ошибку, просто возвращаем то, что получили
    }

    return offerCardsMap;
  }

  /**
   * Получить изображения товаров через offer-mappings endpoint
   * Использует POST /v2/businesses/{businessId}/offer-mappings для получения полной информации включая pictures
   */
  async getOfferMappingsWithImages(
    businessId: string,
    offerIds: string[],
    onProgress?: (current: number, total: number, stage: string) => void
  ): Promise<Map<string, string[]>> {
    const client = await this.getClient(businessId);
    if (!client) {
      throw new Error(`Бизнес ${businessId} не настроен`);
    }

    const imagesMap = new Map<string, string[]>();
    const batchSize = 200; // Максимальный размер батча для API

    onProgress?.(0, offerIds.length, 'Загрузка изображений...');

    try {
      // Обрабатываем offerIds батчами
      for (let i = 0; i < offerIds.length; i += batchSize) {
        const batch = offerIds.slice(i, i + batchSize);
        
        try {
          // Используем search endpoint для получения полной информации о товарах включая pictures
          // Пробуем разные варианты запроса
          let response;
          try {
            // Вариант 1: POST /v2/businesses/{businessId}/offer-mappings/search с offerIds
            response = await client.post<OfferMappingsResponse>(
              `/v2/businesses/${businessId}/offer-mappings/search`,
              {
                offerIds: batch,
                limit: batchSize,
              }
            );
          } catch (searchError: any) {
            // Вариант 2: POST /v2/businesses/{businessId}/offer-mappings с offerIds в body
            try {
              response = await client.post<OfferMappingsResponse>(
                `/v2/businesses/${businessId}/offer-mappings`,
                {
                  offerIds: batch,
                  limit: batchSize,
                }
              );
            } catch (mappingsError: any) {
              // Вариант 3: GET /v2/businesses/{businessId}/offer-mappings с offerIds в query
              console.warn(`[YandexMarketGo] POST методы не работают, пробуем GET...`);
              response = await client.get<OfferMappingsResponse>(
                `/v2/businesses/${businessId}/offer-mappings`,
                {
                  params: {
                    offerIds: batch.join(','),
                    limit: batchSize,
                  }
                }
              );
            }
          }

          if (response.data.result?.offerMappings) {
            const mappingsWithImages = response.data.result.offerMappings.filter(
              (m: OfferMapping) => m.pictures && Array.isArray(m.pictures) && m.pictures.length > 0
            );
            
            console.log(`[YandexMarketGo] Батч ${i}-${i + batchSize}: получено ${response.data.result.offerMappings.length} mappings, из них ${mappingsWithImages.length} с изображениями`);
            
            response.data.result.offerMappings.forEach((mapping: OfferMapping) => {
              if (mapping.pictures && Array.isArray(mapping.pictures) && mapping.pictures.length > 0) {
                const validPictures = mapping.pictures.filter((url: string) => url && url.trim().length > 0);
                if (validPictures.length > 0) {
                  imagesMap.set(mapping.offerId, validPictures);
                }
              }
            });
            
            onProgress?.(imagesMap.size, offerIds.length, `Загружено изображений: ${imagesMap.size}...`);
            
            // Логируем для первого батча
            if (i === 0 && response.data.result.offerMappings.length > 0) {
              const firstMapping = response.data.result.offerMappings[0];
              console.log(`[YandexMarketGo] Структура первого offer-mapping с изображениями:`, {
                offerId: firstMapping.offerId,
                hasPictures: !!firstMapping.pictures,
                picturesCount: firstMapping.pictures?.length || 0,
                pictures: firstMapping.pictures?.slice(0, 3),
                allFields: Object.keys(firstMapping),
              });
            }
          } else {
            console.warn(`[YandexMarketGo] Батч ${i}-${i + batchSize}: нет offerMappings в ответе`);
          }
        } catch (error: any) {
          console.warn(`[YandexMarketGo] Ошибка получения изображений для батча ${i}-${i + batchSize}:`, error.message);
          // Продолжаем обработку следующих батчей
        }

        // Задержка между батчами
        if (i + batchSize < offerIds.length) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
    } catch (error: any) {
      console.error(`[YandexMarketGo] Ошибка получения изображений:`, error.message);
    }

    console.log(`[YandexMarketGo] Всего получено изображений для ${imagesMap.size} товаров из ${offerIds.length}`);
    return imagesMap;
  }

  /**
   * Получить остатки для бизнеса
   * Использует POST /v2/campaigns/{campaignId}/offers/stocks (правильный endpoint по документации)
   */
  async getStocks(
    businessId: string,
    offerIds?: string[],
    onProgress?: (current: number, total: number, stage: string) => void
  ): Promise<Map<string, { available: number; reserved: number }>> {
    const client = await this.getClient(businessId);
    if (!client) {
      throw new Error(`Бизнес ${businessId} не настроен`);
    }

    // Получаем campaignId
    const campaignId = await this.getCampaignId(businessId);
    if (!campaignId) {
      throw new Error(`Не удалось получить campaignId для бизнеса ${businessId}`);
    }

    const stocksMap = new Map<string, { available: number; reserved: number }>();
    let nextPageToken: string | undefined = undefined;
    let page = 0;
    const maxPages = 10000;
    let pagesProcessed = 0;

    onProgress?.(0, 0, 'Загрузка остатков...');

    try {
      while (pagesProcessed < maxPages) {
        const requestBody: any = {};

        if (offerIds && offerIds.length > 0 && page === 0) {
          // Если указаны offerIds, отправляем их батчами (максимум 200 за раз, так как limit может быть ограничен)
          const batchSize = 200; // Уменьшаем размер батча, чтобы соответствовать limit
          for (let i = 0; i < offerIds.length; i += batchSize) {
            const batch = offerIds.slice(i, i + batchSize);
            
            // Формируем body согласно документации
            const requestBody = {
              offerIds: batch,
            };

            try {
              const response: { data: WarehouseStocksResponse } = await client.post<WarehouseStocksResponse>(
                `/v2/campaigns/${campaignId}/offers/stocks`,
                requestBody
                // Не передаем limit в query, когда передаем offerIds в body - это вызывает конфликт
              );

              console.log(`[YandexMarketGo] Ответ на запрос остатков для батча ${i / batchSize + 1}:`, JSON.stringify({
                status: response.data.status,
                warehousesCount: response.data.result?.warehouses?.length || 0,
                hasResult: !!response.data.result,
              }, null, 2));

              // Логируем полную структуру ответа для первого батча
              if (i === 0 && response.data.result?.warehouses && response.data.result.warehouses.length > 0) {
                console.log(`[YandexMarketGo] Пример структуры ответа остатков:`, JSON.stringify({
                  warehouse: response.data.result.warehouses[0],
                  firstOffer: response.data.result.warehouses[0]?.offers?.[0],
                }, null, 2));
              }

              if (response.data.status === 'OK' && response.data.result?.warehouses) {
                let offersProcessed = 0;
                response.data.result.warehouses.forEach(warehouse => {
                  if (warehouse.offers && Array.isArray(warehouse.offers)) {
                    warehouse.offers.forEach(offer => {
                      let available = 0;
                      let reserved = 0;
                      
                      if (offer.stocks && Array.isArray(offer.stocks)) {
                        offer.stocks.forEach(stock => {
                          if (stock.type === 'AVAILABLE' || stock.type === 'FIT') {
                            available += stock.count || 0;
                          } else if (stock.type === 'FREEZE') {
                            reserved += stock.count || 0;
                          }
                        });
                      }

                      if (offer.offerId) {
                        // Нормализуем ключ (убираем пробелы в начале/конце)
                        const normalizedKey = offer.offerId.trim();
                        stocksMap.set(normalizedKey, { available, reserved });
                        offersProcessed++;
                      }
                    });
                  }
                });
                console.log(`[YandexMarketGo] Обработано остатков в батче ${i / batchSize + 1}: ${offersProcessed} из ${batch.length}`);
                onProgress?.(stocksMap.size, offerIds.length, `Загружено остатков: ${stocksMap.size}...`);
              } else {
                console.warn(`[YandexMarketGo] Неожиданный формат ответа для остатков:`, JSON.stringify(response.data, null, 2));
              }
            } catch (batchError: any) {
              console.error(`[YandexMarketGo] Ошибка получения остатков для батча ${i / batchSize + 1}:`, batchError.message);
              console.error(`[YandexMarketGo] Response:`, batchError.response?.data);
              // Продолжаем с следующим батчем
            }

            // Задержка между батчами
            if (i + batchSize < offerIds.length) {
              await new Promise(resolve => setTimeout(resolve, 300));
            }
          }
          break; // Для offerIds не используем пагинацию
        } else {
          // Получаем все остатки с пагинацией
          const queryParams: any = {
            limit: 200,
          };
          if (nextPageToken) {
            queryParams.page_token = nextPageToken;
          }

          try {
            const response: { data: WarehouseStocksResponse } = await client.post<WarehouseStocksResponse>(
              `/v2/campaigns/${campaignId}/offers/stocks`,
              {}, // Пустое тело для получения всех остатков
              {
                params: queryParams
              }
            );

            console.log(`[YandexMarketGo] Ответ на запрос всех остатков (страница ${page + 1}):`, JSON.stringify({
              status: response.data.status,
              warehousesCount: response.data.result?.warehouses?.length || 0,
              hasResult: !!response.data.result,
            }, null, 2));

            // Логируем полную структуру ответа для первой страницы
            if (page === 0 && response.data.result?.warehouses && response.data.result.warehouses.length > 0) {
              console.log(`[YandexMarketGo] Пример структуры ответа остатков (все):`, JSON.stringify({
                warehouse: response.data.result.warehouses[0],
                firstOffer: response.data.result.warehouses[0]?.offers?.[0],
              }, null, 2));
            }

            if (response.data.status === 'OK' && response.data.result?.warehouses) {
              let offersProcessed = 0;
              response.data.result.warehouses.forEach(warehouse => {
                if (warehouse.offers && Array.isArray(warehouse.offers)) {
                  warehouse.offers.forEach(offer => {
                    let available = 0;
                    let reserved = 0;
                    
                    if (offer.stocks && Array.isArray(offer.stocks)) {
                      offer.stocks.forEach(stock => {
                        if (stock.type === 'AVAILABLE' || stock.type === 'FIT') {
                          available += stock.count || 0;
                        } else if (stock.type === 'FREEZE') {
                          reserved += stock.count || 0;
                        }
                      });
                    }

                    if (offer.offerId) {
                      stocksMap.set(offer.offerId, { available, reserved });
                      offersProcessed++;
                    }
                  });
                }
              });
              console.log(`[YandexMarketGo] Обработано остатков на странице ${page + 1}: ${offersProcessed}`);
              onProgress?.(stocksMap.size, stocksMap.size, `Загружено остатков: ${stocksMap.size}...`);

              nextPageToken = response.data.result.paging?.nextPageToken;
              pagesProcessed++;
              page++;

              if (!nextPageToken || pagesProcessed >= maxPages) {
                break;
              }

              await new Promise(resolve => setTimeout(resolve, 200));
            } else {
              console.warn(`[YandexMarketGo] Неожиданный формат ответа для остатков (страница ${page + 1}):`, response.data);
              break;
            }
          } catch (pageError: any) {
            console.error(`[YandexMarketGo] Ошибка получения остатков (страница ${page + 1}):`, pageError.message);
            console.error(`[YandexMarketGo] Response:`, pageError.response?.data);
            break;
          }
        }
      }
    } catch (error: any) {
      console.error(`[YandexMarketGo] Ошибка получения остатков для бизнеса ${businessId}:`, error.message);
      console.error(`[YandexMarketGo] Response:`, error.response?.data);
      // Не бросаем ошибку, просто возвращаем то, что получили
    }

    return stocksMap;
  }

  /**
   * Получить цены для бизнеса с пагинацией
   * Использует POST v2/businesses/{businessId}/offers/prices
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
    const maxPages = 10000; // Защита от бесконечного цикла - максимум 10000 страниц
    let pagesProcessed = 0;

    onProgress?.(0, 0, 'Загрузка цен...');

    while (pagesProcessed < maxPages) {
      try {
        const requestBody: any = {
          limit: 200,
        };

        if (nextPageToken) {
          requestBody.page_token = nextPageToken;
        }

        const response = await client.post<PricesResponse>(
          `/v2/businesses/${businessId}/offers/prices`,
          requestBody
        );

        if (response.data.result?.offers) {
          allPrices.push(...response.data.result.offers);
          onProgress?.(allPrices.length, allPrices.length, `Загружено цен: ${allPrices.length}...`);

          nextPageToken = response.data.result.paging?.nextPageToken || response.data.result.paging?.pageToken;
          page++;
          pagesProcessed++;

          if (!nextPageToken || pagesProcessed >= maxPages) {
            if (pagesProcessed >= maxPages) {
              console.warn(`[YandexMarketGo] Достигнут лимит страниц (${maxPages}) для бизнеса ${businessId}`);
            }
            break;
          }

          await new Promise(resolve => setTimeout(resolve, 200));
        } else {
          break;
        }
      } catch (error: any) {
        console.error(`[YandexMarketGo] Ошибка получения цен для бизнеса ${businessId}, страница ${page}:`, error.message);
        
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
   * Получить установленные цены для конкретных offerIds
   * Использует POST v2/campaigns/{campaignId}/offer-prices
   * Возвращает установленные цены, а не те, что показываются покупателю
   */
  async getOfferPrices(
    businessId: string,
    offerIds: string[]
  ): Promise<Map<string, { value: number; currencyId: string; discountBase?: number; vat?: number; updatedAt?: string }>> {
    const client = await this.getClient(businessId);
    if (!client) {
      throw new Error(`Бизнес ${businessId} не настроен`);
    }

    // Получаем campaignId
    const campaignId = await this.getCampaignId(businessId);
    if (!campaignId) {
      throw new Error(`Не удалось получить campaignId для бизнеса ${businessId}`);
    }

    const pricesMap = new Map<string, { value: number; currencyId: string; discountBase?: number; vat?: number; updatedAt?: string }>();

    try {
      // Разбиваем на батчи по 2000 товаров (максимум по документации)
      const batchSize = 2000;
      
      for (let i = 0; i < offerIds.length; i += batchSize) {
        const batch = offerIds.slice(i, i + batchSize);
        
        const requestBody = {
          offerIds: batch,
        };

        try {
          const response = await client.post<{
            status: string;
            result?: {
              offers?: Array<{
                offerId: string;
                price?: {
                  value: number;
                  currencyId: string;
                  discountBase?: number;
                  vat?: number;
                };
                updatedAt?: string;
              }>;
              paging?: {
                nextPageToken?: string;
              };
            };
          }>(
            `/v2/campaigns/${campaignId}/offer-prices`,
            requestBody
          );

          if (response.data?.result?.offers) {
            response.data.result.offers.forEach((offer) => {
              if (offer.price && offer.offerId) {
                pricesMap.set(offer.offerId, {
                  value: offer.price.value,
                  currencyId: offer.price.currencyId,
                  discountBase: offer.price.discountBase,
                  vat: offer.price.vat,
                  updatedAt: offer.updatedAt,
                });
              }
            });
          }

          // Задержка между батчами
          if (i + batchSize < offerIds.length) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        } catch (error: any) {
          console.error(`[YandexMarketGo] Ошибка получения цен для бизнеса ${businessId}, батч ${i / batchSize + 1}:`, error.message);
          
          if (error.response?.status === 429) {
            // Rate limit, ждем дольше
            await new Promise(resolve => setTimeout(resolve, 5000));
            i -= batchSize; // Повторяем батч
            continue;
          }

          // Продолжаем обработку других батчей при ошибке
          console.warn(`[YandexMarketGo] Пропущен батч из-за ошибки`);
        }
      }
    } catch (error: any) {
      console.error(`[YandexMarketGo] Ошибка получения цен для бизнеса ${businessId}:`, error.message);
      throw new Error(`Ошибка получения цен: ${error.response?.data?.errors?.[0]?.message || error.message}`);
    }

    return pricesMap;
  }

  /**
   * Обновить цены для бизнеса
   * Использует POST /v2/campaigns/{campaignId}/offer-prices/updates (правильный endpoint по документации)
   */
  async updatePrices(
    businessId: string,
    offers: Array<{ offerId: string; price: { value: string; currencyId: string } }>
  ): Promise<{ success: boolean; errors?: Array<{ code: string; message: string }> }> {
    const client = await this.getClient(businessId);
    if (!client) {
      throw new Error(`Бизнес ${businessId} не настроен`);
    }

    // Получаем campaignId
    const campaignId = await this.getCampaignId(businessId);
    if (!campaignId) {
      throw new Error(`Не удалось получить campaignId для бизнеса ${businessId}`);
    }

    try {
      // Разбиваем на батчи по 2000 товаров (максимум по документации)
      const batchSize = 2000;
      const batches: Array<Array<{ offerId: string; price: { value: string; currencyId: string } }>> = [];
      
      for (let i = 0; i < offers.length; i += batchSize) {
        batches.push(offers.slice(i, i + batchSize));
      }

      const allErrors: Array<{ code: string; message: string }> = [];

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        // Формируем запрос согласно документации
        const requestBody = {
          offers: batch.map(offer => ({
            offerId: offer.offerId,
            price: {
              value: parseFloat(offer.price.value), // Должно быть число, не строка
              currencyId: offer.price.currencyId || 'RUR',
            },
          })),
        };

        try {
          const response: { data: { status: string; errors?: Array<{ code: string; message: string }> } } = await client.post(
            `/v2/campaigns/${campaignId}/offer-prices/updates`,
            requestBody
          );

          if (response.data.status !== 'OK') {
            allErrors.push({
              code: 'ERROR',
              message: 'Ошибка обновления цен',
            });
          }

          if (response.data.errors) {
            allErrors.push(...response.data.errors);
          }

          // Задержка между батчами (лимит: 10,000 товаров в минуту)
          if (i < batches.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (error: any) {
          console.error(`[YandexMarketGo] Ошибка обновления цен для бизнеса ${businessId}, батч ${i + 1}:`, error.message);
          console.error(`[YandexMarketGo] Response:`, error.response?.data);
          
          if (error.response?.status === 429) {
            // Rate limit, ждем дольше
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
      console.error(`[YandexMarketGo] Критическая ошибка обновления цен для бизнеса ${businessId}:`, error.message);
      throw new Error(`Ошибка обновления цен: ${error.response?.data?.errors?.[0]?.message || error.message}`);
    }
  }

  /**
   * Обновить название и описание оффера
   * Использует POST v2/businesses/{businessId}/offer-mappings/update
   */
  async updateOfferMapping(
    businessId: string,
    offerId: string,
    name?: string,
    description?: string,
    language: string = 'ru'
  ): Promise<{ success: boolean; error?: string }> {
    const client = await this.getClient(businessId);
    if (!client) {
      throw new Error(`Бизнес ${businessId} не настроен`);
    }

    try {
      const requestBody: UpdateOfferMappingRequest = {
        offerId,
        language,
      };

      if (name) requestBody.name = name;
      if (description) requestBody.description = description;

      const response = await client.post(
        `/v2/businesses/${businessId}/offer-mappings/update`,
        requestBody
      );

      return { success: true };
    } catch (error: any) {
      console.error(`[YandexMarketGo] Ошибка обновления оффера ${offerId} для бизнеса ${businessId}:`, error.message);
      return {
        success: false,
        error: error.response?.data?.errors?.[0]?.message || error.message,
      };
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
          console.log(`[YandexMarketGo] Retry ${attempt + 1}/${maxRetries} через ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        throw error;
      }
    }

    throw lastError || new Error('Неизвестная ошибка');
  }
}

export const yandexMarketGoService = new YandexMarketGoService();

