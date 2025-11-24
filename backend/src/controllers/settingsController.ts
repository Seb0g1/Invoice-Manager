import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import Settings from '../models/Settings';
import telegramService from '../services/telegramService';

export const getSettings = async (req: AuthRequest, res: Response) => {
  try {
    let settings = await Settings.findOne();
    
    if (!settings) {
      // Создаем настройки по умолчанию
      settings = new Settings({
        theme: 'auto',
        autoNightModeEnabled: false,
        nightModeStartTime: '22:00',
        nightModeEndTime: '07:00',
        telegramEnabled: false,
        sidebarEnabled: true,
        hiddenPages: [
          '/yandex',
          '/ozon',
          '/ozon/products',
          '/ozon/prices',
          '/ozon/chats',
          '/ozon/analytics',
          '/ozon/search-queries',
          '/ozon/finance'
        ],
        rolePermissions: {
          collector: {
            visiblePages: ['/invoices', '/picking-lists', '/warehouse', '/suppliers'],
            accessibleRoutes: ['/invoices', '/picking-lists', '/warehouse', '/suppliers'],
          },
        },
      });
      await settings.save();
    }

    // Обрабатываем rolePermissions
    let rolePermissions: any = {};
    if (settings.rolePermissions && typeof settings.rolePermissions === 'object') {
      rolePermissions = settings.rolePermissions instanceof Map 
        ? Object.fromEntries(settings.rolePermissions) 
        : settings.rolePermissions;
    }
    
    // Инициализируем дефолтные права для сборщика, если их нет или они пустые
    if (!rolePermissions.collector || 
        !rolePermissions.collector.visiblePages || 
        rolePermissions.collector.visiblePages.length === 0) {
      rolePermissions = {
        ...rolePermissions,
        collector: {
          visiblePages: ['/invoices', '/picking-lists', '/warehouse', '/suppliers'],
          accessibleRoutes: ['/invoices', '/picking-lists', '/warehouse', '/suppliers'],
        },
      };
    }

    // Временно скрываем страницы OZON и Yandex Market для всех
    const defaultHiddenPages = [
      '/yandex',
      '/ozon',
      '/ozon/products',
      '/ozon/prices',
      '/ozon/chats',
      '/ozon/analytics',
      '/ozon/search-queries',
      '/ozon/finance'
    ];
    const hiddenPages = settings.hiddenPages || [];
    // Объединяем скрытые страницы с дефолтными (убираем дубликаты)
    const allHiddenPages = [...new Set([...defaultHiddenPages, ...hiddenPages])];

    // Не возвращаем полный токен для безопасности
    const responseData: any = {
      theme: settings.theme,
      autoNightModeEnabled: settings.autoNightModeEnabled,
      nightModeStartTime: settings.nightModeStartTime,
      nightModeEndTime: settings.nightModeEndTime,
      telegramEnabled: settings.telegramEnabled,
      telegramTopics: settings.telegramTopics || {},
      sidebarEnabled: settings.sidebarEnabled !== undefined ? settings.sidebarEnabled : true,
      hiddenPages: allHiddenPages,
      rolePermissions: rolePermissions,
    };

    if (settings.telegramBotToken) {
      responseData.telegramBotToken = `${settings.telegramBotToken.substring(0, 4)}****`;
    } else {
      responseData.telegramBotToken = '';
    }

    if (settings.telegramChatId) {
      responseData.telegramChatId = settings.telegramChatId;
    } else {
      responseData.telegramChatId = '';
    }

    res.json(responseData);
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

export const updateSettings = async (req: AuthRequest, res: Response) => {
  try {
    const {
      theme,
      autoNightModeEnabled,
      nightModeStartTime,
      nightModeEndTime,
      telegramBotToken,
      telegramChatId,
      telegramTopics,
      telegramEnabled,
      sidebarEnabled,
      hiddenPages,
      rolePermissions,
    } = req.body;

    let settings = await Settings.findOne();

    if (!settings) {
      settings = new Settings();
    }

    if (theme !== undefined) {
      settings.theme = theme;
    }
    if (autoNightModeEnabled !== undefined) {
      settings.autoNightModeEnabled = autoNightModeEnabled;
    }
    if (nightModeStartTime !== undefined) {
      settings.nightModeStartTime = nightModeStartTime;
    }
    if (nightModeEndTime !== undefined) {
      settings.nightModeEndTime = nightModeEndTime;
    }
    if (telegramBotToken !== undefined) {
      // Если токен начинается с "****", значит пользователь не менял его
      if (!telegramBotToken.startsWith('****')) {
        settings.telegramBotToken = telegramBotToken.trim();
      }
    }
    if (telegramChatId !== undefined) {
      settings.telegramChatId = telegramChatId.trim();
    }
    if (telegramTopics !== undefined) {
      settings.telegramTopics = {
        ...settings.telegramTopics,
        ...telegramTopics,
      };
    }
    if (telegramEnabled !== undefined) {
      settings.telegramEnabled = telegramEnabled;
    }
    if (sidebarEnabled !== undefined) {
      settings.sidebarEnabled = sidebarEnabled;
    }
    if (hiddenPages !== undefined) {
      settings.hiddenPages = hiddenPages;
    }
    if (rolePermissions !== undefined) {
      // Инициализируем дефолтные права для сборщика, если их нет
      let finalRolePermissions = rolePermissions;
      if (!finalRolePermissions.collector || 
          !finalRolePermissions.collector.visiblePages || 
          finalRolePermissions.collector.visiblePages.length === 0) {
        finalRolePermissions = {
          ...finalRolePermissions,
          collector: {
            visiblePages: ['/invoices', '/picking-lists', '/warehouse', '/suppliers'],
            accessibleRoutes: ['/invoices', '/picking-lists', '/warehouse', '/suppliers'],
          },
        };
      }
      // Сохраняем как обычный объект
      settings.rolePermissions = finalRolePermissions;
    }

    await settings.save();

    // Переинициализируем Telegram сервис
    telegramService.clearCache();
    await telegramService.initialize();

    // Не возвращаем полный токен
    const responseData: any = {
      theme: settings.theme,
      autoNightModeEnabled: settings.autoNightModeEnabled,
      nightModeStartTime: settings.nightModeStartTime,
      nightModeEndTime: settings.nightModeEndTime,
      telegramEnabled: settings.telegramEnabled,
      telegramTopics: settings.telegramTopics || {},
      sidebarEnabled: settings.sidebarEnabled !== undefined ? settings.sidebarEnabled : true,
      hiddenPages: settings.hiddenPages || [],
      rolePermissions: settings.rolePermissions && typeof settings.rolePermissions === 'object'
        ? (settings.rolePermissions instanceof Map 
          ? Object.fromEntries(settings.rolePermissions) 
          : settings.rolePermissions)
        : {},
    };

    if (settings.telegramBotToken) {
      responseData.telegramBotToken = `${settings.telegramBotToken.substring(0, 4)}****`;
    } else {
      responseData.telegramBotToken = '';
    }

    if (settings.telegramChatId) {
      responseData.telegramChatId = settings.telegramChatId;
    } else {
      responseData.telegramChatId = '';
    }

    res.json({
      message: 'Настройки обновлены',
      ...responseData,
    });
  } catch (error: any) {
    console.error('Update settings error:', error);
    res.status(500).json({ message: error.message || 'Ошибка сервера' });
  }
};

export const testTelegramConnection = async (req: AuthRequest, res: Response) => {
  try {
    const { telegramBotToken, telegramChatId } = req.body;

    if (!telegramBotToken || !telegramChatId) {
      return res.status(400).json({ message: 'Bot Token и Chat ID обязательны' });
    }

    // Временно инициализируем сервис с переданными данными
    const testClient = require('axios').create({
      baseURL: `https://api.telegram.org/bot${telegramBotToken}`,
      timeout: 10000,
    });

    // Проверяем бота
    const botInfo = await testClient.get('/getMe');
    if (!botInfo.data.ok) {
      return res.status(400).json({ message: 'Неверный Bot Token' });
    }

    // Пробуем отправить тестовое сообщение
    await testClient.post('/sendMessage', {
      chat_id: telegramChatId,
      text: '✅ Тестовое сообщение от David Manager',
      parse_mode: 'HTML',
    });

    res.json({
      success: true,
      message: 'Подключение к Telegram успешно',
      botName: botInfo.data.result.username,
    });
  } catch (error: any) {
    if (error.response?.data?.description) {
      return res.status(400).json({
        success: false,
        message: `Ошибка Telegram API: ${error.response.data.description}`,
      });
    }
    res.status(400).json({
      success: false,
      message: error.message || 'Ошибка подключения к Telegram',
    });
  }
};

