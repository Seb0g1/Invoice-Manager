import { Response } from 'express';
import { YandexBusiness } from '../models/YandexBusiness';
import { AuthRequest } from '../middleware/auth';

/**
 * Получить все бизнесы
 */
export const getBusinesses = async (req: AuthRequest, res: Response) => {
  try {
    const businesses = await YandexBusiness.find({}).sort({ name: 1 });
    // Возвращаем в формате, который ожидает фронтенд
    res.json({ businesses });
  } catch (error: any) {
    console.error('[YandexBusiness] Ошибка получения бизнесов:', error);
    res.status(500).json({ message: error.message || 'Ошибка получения бизнесов' });
  }
};

/**
 * Получить бизнес по ID
 */
export const getBusinessById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const business = await YandexBusiness.findById(id);
    
    if (!business) {
      return res.status(404).json({ message: 'Бизнес не найден' });
    }
    
    res.json(business);
  } catch (error: any) {
    console.error('[YandexBusiness] Ошибка получения бизнеса:', error);
    res.status(500).json({ message: error.message || 'Ошибка получения бизнеса' });
  }
};

/**
 * Создать новый бизнес
 */
export const createBusiness = async (req: AuthRequest, res: Response) => {
  try {
    const { businessId, name, accessToken, refreshToken, tokenExpiresAt, enabled } = req.body;

    if (!businessId || !name || !accessToken) {
      return res.status(400).json({ message: 'businessId, name и accessToken обязательны' });
    }

    // Проверяем, не существует ли уже бизнес с таким businessId
    const existing = await YandexBusiness.findOne({ businessId });
    if (existing) {
      return res.status(400).json({ message: 'Бизнес с таким businessId уже существует' });
    }

    const business = new YandexBusiness({
      businessId,
      name,
      accessToken,
      refreshToken,
      tokenExpiresAt: tokenExpiresAt ? new Date(tokenExpiresAt) : undefined,
      enabled: enabled !== undefined ? enabled : true,
    });

    await business.save();
    res.status(201).json(business);
  } catch (error: any) {
    console.error('[YandexBusiness] Ошибка создания бизнеса:', error);
    res.status(500).json({ message: error.message || 'Ошибка создания бизнеса' });
  }
};

/**
 * Обновить бизнес
 */
export const updateBusiness = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, accessToken, refreshToken, tokenExpiresAt, enabled } = req.body;

    const business = await YandexBusiness.findById(id);
    if (!business) {
      return res.status(404).json({ message: 'Бизнес не найден' });
    }

    if (name !== undefined) business.name = name;
    if (accessToken !== undefined) business.accessToken = accessToken;
    if (refreshToken !== undefined) business.refreshToken = refreshToken;
    if (tokenExpiresAt !== undefined) business.tokenExpiresAt = tokenExpiresAt ? new Date(tokenExpiresAt) : undefined;
    if (enabled !== undefined) business.enabled = enabled;

    await business.save();
    res.json(business);
  } catch (error: any) {
    console.error('[YandexBusiness] Ошибка обновления бизнеса:', error);
    res.status(500).json({ message: error.message || 'Ошибка обновления бизнеса' });
  }
};

/**
 * Удалить бизнес
 */
export const deleteBusiness = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const business = await YandexBusiness.findByIdAndDelete(id);
    
    if (!business) {
      return res.status(404).json({ message: 'Бизнес не найден' });
    }
    
    res.json({ message: 'Бизнес успешно удален' });
  } catch (error: any) {
    console.error('[YandexBusiness] Ошибка удаления бизнеса:', error);
    res.status(500).json({ message: error.message || 'Ошибка удаления бизнеса' });
  }
};

/**
 * Тест подключения к API бизнеса
 */
export const testBusinessConnection = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const business = await YandexBusiness.findById(id);
    
    if (!business) {
      return res.status(404).json({ message: 'Бизнес не найден' });
    }

    if (!business.accessToken) {
      return res.status(400).json({ message: 'AccessToken не настроен' });
    }

    // Используем метод тестирования, который делает только один запрос
    const { yandexMarketGoService } = await import('../services/yandexMarketGoService');
    const testResult = await yandexMarketGoService.testConnection(business.businessId);

    if (testResult.success) {
      res.json({
        success: true,
        message: testResult.message || 'Подключение успешно',
        offersCount: testResult.offersCount || 0,
      });
    } else {
      res.status(500).json({
        success: false,
        message: testResult.message || 'Ошибка подключения к API',
      });
    }
  } catch (error: any) {
    console.error('[YandexBusiness] Ошибка тестирования подключения:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Ошибка подключения к API',
    });
  }
};

