import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import YandexAccount from '../models/YandexAccount';
import yandexService from '../services/yandexService';

export const getYandexAccounts = async (req: AuthRequest, res: Response) => {
  try {
    const accounts = await YandexAccount.find().sort({ createdAt: -1 });
    res.json(accounts.map(acc => ({
      _id: acc._id,
      name: acc.name,
      apiKey: acc.apiKey ? `${acc.apiKey.substring(0, 4)}****` : '',
      businessId: acc.businessId,
      enabled: acc.enabled,
      createdAt: acc.createdAt,
      updatedAt: acc.updatedAt,
    })));
  } catch (error) {
    console.error('Get Yandex accounts error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

export const getYandexAccountById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const account = await YandexAccount.findById(id);
    
    if (!account) {
      return res.status(404).json({ message: 'Аккаунт не найден' });
    }

    res.json({
      _id: account._id,
      name: account.name,
      apiKey: account.apiKey ? `${account.apiKey.substring(0, 4)}****` : '',
      businessId: account.businessId,
      enabled: account.enabled,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    });
  } catch (error) {
    console.error('Get Yandex account error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

export const createYandexAccount = async (req: AuthRequest, res: Response) => {
  try {
    const { name, apiKey } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Название аккаунта обязательно' });
    }

    if (!apiKey || !apiKey.trim()) {
      return res.status(400).json({ message: 'API-ключ обязателен' });
    }

    // Пытаемся получить businessId
    const tempAccount = new YandexAccount({
      name: name.trim(),
      apiKey: apiKey.trim(),
      enabled: true,
    });
    await tempAccount.save();

    try {
      const businessId = await yandexService.getBusinessId(tempAccount._id.toString());
      if (businessId) {
        tempAccount.businessId = businessId;
        await tempAccount.save();
      }
    } catch (error) {
      console.error('Failed to get business ID:', error);
      // Продолжаем без businessId
    }

    yandexService.clearCache(tempAccount._id.toString());

    res.status(201).json({
      _id: tempAccount._id,
      name: tempAccount.name,
      apiKey: `${tempAccount.apiKey.substring(0, 4)}****`,
      businessId: tempAccount.businessId,
      enabled: tempAccount.enabled,
    });
  } catch (error: any) {
    console.error('Create Yandex account error:', error);
    res.status(500).json({ message: error.message || 'Ошибка сервера' });
  }
};

export const updateYandexAccount = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, apiKey, enabled } = req.body;

    const account = await YandexAccount.findById(id);
    if (!account) {
      return res.status(404).json({ message: 'Аккаунт не найден' });
    }

    if (name && name.trim()) {
      account.name = name.trim();
    }

    if (apiKey && apiKey.trim()) {
      account.apiKey = apiKey.trim();
      // Обновляем businessId при изменении API ключа
      try {
        const businessId = await yandexService.getBusinessId(id);
        if (businessId) {
          account.businessId = businessId;
        }
      } catch (error) {
        console.error('Failed to update business ID:', error);
      }
    }

    if (enabled !== undefined) {
      account.enabled = enabled;
    }

    await account.save();
    yandexService.clearCache(id);

    res.json({
      _id: account._id,
      name: account.name,
      apiKey: `${account.apiKey.substring(0, 4)}****`,
      businessId: account.businessId,
      enabled: account.enabled,
    });
  } catch (error: any) {
    console.error('Update Yandex account error:', error);
    res.status(500).json({ message: error.message || 'Ошибка сервера' });
  }
};

export const deleteYandexAccount = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const account = await YandexAccount.findById(id);
    if (!account) {
      return res.status(404).json({ message: 'Аккаунт не найден' });
    }

    await YandexAccount.findByIdAndDelete(id);
    yandexService.clearCache(id);

    res.json({ message: 'Аккаунт успешно удалён' });
  } catch (error) {
    console.error('Delete Yandex account error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

export const testYandexConnection = async (req: AuthRequest, res: Response) => {
  try {
    const { accountId } = req.body;

    if (!accountId) {
      return res.status(400).json({ message: 'ID аккаунта обязателен' });
    }

    const campaigns = await yandexService.getCampaigns(accountId);
    
    res.json({ 
      success: true,
      message: 'Подключение к Yandex Market API успешно',
      campaignsCount: campaigns.length,
      campaigns: campaigns.map(c => ({
        id: c.id,
        domain: c.domain,
        businessName: c.business?.name,
      })),
    });
  } catch (error: any) {
    res.status(400).json({ 
      success: false,
      message: error.message || 'Ошибка подключения к Yandex Market API' 
    });
  }
};

export const getYandexProducts = async (req: AuthRequest, res: Response) => {
  try {
    const { accountId, businessId, page, pageSize } = req.query;

    if (!accountId) {
      return res.status(400).json({ message: 'ID аккаунта обязателен' });
    }

    const account = await YandexAccount.findById(accountId);
    if (!account || !account.enabled) {
      return res.status(400).json({ message: 'Аккаунт не найден или отключен' });
    }

    const finalBusinessId = businessId || account.businessId;
    if (!finalBusinessId) {
      return res.status(400).json({ message: 'Business ID не найден. Проверьте настройки аккаунта.' });
    }

    const result = await yandexService.getProducts(
      accountId as string,
      finalBusinessId as string,
      page ? parseInt(page as string) : undefined,
      pageSize ? parseInt(pageSize as string) : 100
    );

    // Форматируем данные для фронтенда
    const products = result.products.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      vendor: item.vendor,
      pictures: item.pictures || [],
      primaryImage: item.pictures && item.pictures.length > 0 ? item.pictures[0] : null,
      barcodes: item.barcodes || [],
      price: item.price?.value || 0,
      currency: item.price?.currencyId || 'RUR',
      oldPrice: item.oldPrice?.value || null,
      availability: item.availability,
      count: item.count || 0,
      sku: item.sku,
      offerId: item.offerId,
    }));

    res.json({
      products,
      total: result.total,
      page: result.page,
      pages: result.pages,
    });
  } catch (error: any) {
    console.error('Get Yandex products error:', error);
    res.status(500).json({ 
      message: error.message || 'Ошибка при получении товаров Yandex Market' 
    });
  }
};

export const syncYandexProducts = async (req: AuthRequest, res: Response) => {
  try {
    const { accountId, businessId } = req.body;

    if (!accountId) {
      return res.status(400).json({ message: 'ID аккаунта обязателен' });
    }

    const account = await YandexAccount.findById(accountId);
    if (!account || !account.enabled) {
      return res.status(400).json({ message: 'Аккаунт не найден или отключен' });
    }

    const finalBusinessId = businessId || account.businessId;
    if (!finalBusinessId) {
      return res.status(400).json({ message: 'Business ID не найден' });
    }

    // Получаем первую страницу для определения общего количества
    const firstPage = await yandexService.getProducts(accountId, finalBusinessId, 1, 100);
    const total = firstPage.total;

    // Начинаем синхронизацию в фоне
    // В реальном приложении лучше использовать очереди (Bull, BullMQ) или WebSocket для прогресса
    const syncPromise = yandexService.getAllProducts(
      accountId,
      finalBusinessId,
      (current, total) => {
        // Здесь можно отправлять прогресс через WebSocket или сохранять в Redis
        console.log(`Синхронизация Yandex: ${current}/${total}`);
      }
    );

    // Возвращаем начальный ответ с информацией о прогрессе
    res.json({ 
      message: 'Синхронизация начата',
      accountId,
      businessId: finalBusinessId,
      total,
      progress: {
        current: 0,
        total,
      },
    });

    // Запускаем синхронизацию
    syncPromise
      .then((products) => {
        console.log(`Синхронизация Yandex завершена: получено ${products.length} товаров`);
      })
      .catch(error => {
        console.error('Sync Yandex error:', error);
      });
  } catch (error: any) {
    console.error('Sync Yandex products error:', error);
    res.status(500).json({ 
      message: error.message || 'Ошибка при синхронизации товаров' 
    });
  }
};

