import axios, { AxiosInstance } from 'axios';
import YandexAccount from '../models/YandexAccount';

interface YandexCampaign {
  id: number;
  domain: string;
  business: {
    id: number;
    name: string;
  };
  campaignType: string;
}

interface YandexProduct {
  id: number;
  name: string;
  category: string;
  vendor: string;
  pictures: string[];
  barcodes: string[];
  vat: string;
  price: {
    value: number;
    currencyId: string;
  };
  oldPrice?: {
    value: number;
    currencyId: string;
  };
  availability: string;
  count?: number;
  sku?: string;
  offerId?: string;
}

interface YandexApiResponse<T> {
  status: string;
  result?: T;
  errors?: Array<{ code: string; message: string }>;
}

class YandexService {
  private clients: Map<string, AxiosInstance> = new Map();

  async getClient(accountId: string): Promise<AxiosInstance | null> {
    if (this.clients.has(accountId)) {
      return this.clients.get(accountId)!;
    }

    const account = await YandexAccount.findById(accountId);
    if (!account || !account.enabled || !account.apiKey) {
      return null;
    }

    const client = axios.create({
      baseURL: 'https://api.partner.market.yandex.ru',
      headers: {
        'Authorization': `OAuth ${account.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    this.clients.set(accountId, client);
    return client;
  }

  async getCampaigns(accountId: string): Promise<YandexCampaign[]> {
    const client = await this.getClient(accountId);
    if (!client) {
      throw new Error('Yandex аккаунт не настроен');
    }

    try {
      const response = await client.get<YandexApiResponse<{ campaigns: YandexCampaign[] }>>('/v2/campaigns');
      
      if (response.data.status === 'ERROR' || !response.data.result) {
        throw new Error(response.data.errors?.[0]?.message || 'Ошибка получения кампаний');
      }

      return response.data.result.campaigns || [];
    } catch (error: any) {
      if (error.response) {
        throw new Error(`Yandex API ошибка: ${error.response.data?.message || error.response.statusText}`);
      }
      throw new Error('Ошибка подключения к Yandex API');
    }
  }

  async getBusinessId(accountId: string): Promise<string | null> {
    try {
      const campaigns = await this.getCampaigns(accountId);
      if (campaigns.length > 0 && campaigns[0].business) {
        return campaigns[0].business.id.toString();
      }
      return null;
    } catch (error) {
      console.error('Get business ID error:', error);
      return null;
    }
  }

  async getProducts(
    accountId: string,
    businessId: string,
    page?: number,
    pageSize: number = 100
  ): Promise<{ products: YandexProduct[]; total: number; page: number; pages: number }> {
    const client = await this.getClient(accountId);
    if (!client) {
      throw new Error('Yandex аккаунт не настроен');
    }

    try {
      const currentPage = page || 1;
      const response = await client.post<YandexApiResponse<{
        result: {
          items: YandexProduct[];
          paging: {
            nextPageToken?: string;
            prevPageToken?: string;
          };
        };
        total?: number;
      }>>(
        `/v2/businesses/${businessId}/offer-mapping-entries`,
        {
          limit: pageSize,
          page_token: currentPage > 1 ? `page_${currentPage}` : undefined,
        }
      );

      if (response.data.status === 'ERROR' || !response.data.result) {
        throw new Error(response.data.errors?.[0]?.message || 'Ошибка получения товаров');
      }

      const items = response.data.result.result?.items || [];
      const total = response.data.result.total || items.length;
      const pages = Math.ceil(total / pageSize);

      return {
        products: items,
        total,
        page: currentPage,
        pages,
      };
    } catch (error: any) {
      // Если метод не работает, попробуем альтернативный через кампании
      try {
        const campaigns = await this.getCampaigns(accountId);
        if (campaigns.length === 0) {
          throw new Error('Нет доступных кампаний');
        }

        const campaignId = campaigns[0].id;
        const altPage = page || 1;
        const response = await client.post<YandexApiResponse<{
          result: {
            items: YandexProduct[];
            paging: {
              nextPageToken?: string;
            };
          };
        }>>(
          `/v2/campaigns/${campaignId}/offer-mapping-entries`,
          {
            limit: pageSize,
            page_token: altPage > 1 ? `page_${altPage}` : undefined,
          }
        );

        if (response.data.status === 'ERROR' || !response.data.result) {
          throw new Error(response.data.errors?.[0]?.message || 'Ошибка получения товаров');
        }

        const items = response.data.result.result?.items || [];
        return {
          products: items,
          total: items.length,
          page: altPage,
          pages: 1,
        };
      } catch (altError: any) {
        if (altError.response) {
          throw new Error(`Yandex API ошибка: ${altError.response.data?.message || altError.response.statusText}`);
        }
        throw new Error('Ошибка подключения к Yandex API');
      }
    }
  }

  async getAllProducts(
    accountId: string,
    businessId: string,
    onProgress?: (current: number, total: number) => void
  ): Promise<YandexProduct[]> {
    const allProducts: YandexProduct[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const result = await this.getProducts(accountId, businessId, page, 100);
      allProducts.push(...result.products);
      
      if (onProgress) {
        onProgress(allProducts.length, result.total);
      }

      hasMore = page < result.pages;
      page++;
    }

    return allProducts;
  }

  clearCache(accountId?: string) {
    if (accountId) {
      this.clients.delete(accountId);
    } else {
      this.clients.clear();
    }
  }
}

export default new YandexService();

