import axios, { AxiosInstance } from 'axios';
import Settings from '../models/Settings';

class TelegramService {
  private client: AxiosInstance | null = null;
  private config: {
    botToken: string;
    chatId: string;
    topics: {
      invoiceAdded?: string;
      pickingListItemCollected?: string;
      supplierBalanceChanged?: string;
    };
    enabled: boolean;
  } | null = null;

  async initialize() {
    const settings = await Settings.findOne();
    if (!settings || !settings.telegramEnabled || !settings.telegramBotToken || !settings.telegramChatId) {
      this.client = null;
      this.config = null;
      return false;
    }

    this.config = {
      botToken: settings.telegramBotToken,
      chatId: settings.telegramChatId,
      topics: settings.telegramTopics || {},
      enabled: settings.telegramEnabled,
    };

    this.client = axios.create({
      baseURL: `https://api.telegram.org/bot${settings.telegramBotToken}`,
      timeout: 10000,
    });

    return true;
  }

  async sendMessage(
    text: string,
    topic?: 'invoiceAdded' | 'pickingListItemCollected' | 'supplierBalanceChanged',
    photoUrl?: string,
    photoPath?: string
  ): Promise<boolean> {
    if (!this.client || !this.config || !this.config.enabled) {
      await this.initialize();
      if (!this.client || !this.config || !this.config.enabled) {
        return false;
      }
    }

    try {
      const messageThreadId = topic ? this.config.topics[topic] : undefined;

      // Если есть фото, отправляем с фото
      if (photoPath) {
        // Отправляем файл напрямую
        const FormData = require('form-data');
        const fs = require('fs');
        const form = new FormData();
        form.append('chat_id', this.config.chatId);
        if (messageThreadId) {
          form.append('message_thread_id', messageThreadId);
        }
        form.append('caption', text);
        form.append('parse_mode', 'HTML');
        form.append('photo', fs.createReadStream(photoPath));

        try {
          await this.client.post('/sendPhoto', form, {
            headers: form.getHeaders(),
          });
        } catch (fileError: any) {
          // Если отправка файла не удалась, пробуем отправить по URL
          if (photoUrl) {
            console.warn('Failed to send photo file, trying URL:', fileError.message);
            await this.client.post('/sendPhoto', {
              chat_id: this.config.chatId,
              message_thread_id: messageThreadId,
              photo: photoUrl,
              caption: text,
              parse_mode: 'HTML',
            });
          } else {
            // Если нет URL, отправляем только текст
            await this.client.post('/sendMessage', {
              chat_id: this.config.chatId,
              message_thread_id: messageThreadId,
              text: text + '\n\n⚠️ Не удалось отправить фото',
              parse_mode: 'HTML',
            });
          }
        }
      } else if (photoUrl) {
        // Если передан URL, отправляем по URL
        await this.client.post('/sendPhoto', {
          chat_id: this.config.chatId,
          message_thread_id: messageThreadId,
          photo: photoUrl,
          caption: text,
          parse_mode: 'HTML',
        });
      } else {
        // Отправляем только текст
        await this.client.post('/sendMessage', {
          chat_id: this.config.chatId,
          message_thread_id: messageThreadId,
          text,
          parse_mode: 'HTML',
        });
      }

      return true;
    } catch (error: any) {
      const errorMessage = error.response?.data?.description || error.response?.data?.message || error.message;
      console.error('Telegram send message error:', errorMessage);
      // Не логируем полный ответ, чтобы не засорять логи
      if (error.response?.status === 401) {
        console.error('Telegram authentication failed. Check bot token.');
      } else if (error.response?.status === 400) {
        console.error('Telegram API error:', errorMessage);
      }
      return false;
    }
  }

  async notifyInvoiceAdded(employeeName: string, supplierName: string, photoUrl?: string, photoPath?: string): Promise<boolean> {
    const text = `📄 <b>Новая накладная</b>\n\n` +
                 `Сотрудник: <b>${employeeName}</b>\n` +
                 `Поставщик: <b>${supplierName}</b>\n` +
                 `Время: ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}`;

    return this.sendMessage(text, 'invoiceAdded', photoUrl, photoPath);
  }

  async notifyPickingListItemCollected(employeeName: string, itemName: string, status: 'collected' | 'not_collected'): Promise<boolean> {
    const statusText = status === 'collected' ? '✅ Собран' : '❌ Не собран';
    const text = `📦 <b>Изменение статуса товара</b>\n\n` +
                 `Сотрудник: <b>${employeeName}</b>\n` +
                 `Товар: <b>${itemName}</b>\n` +
                 `Статус: ${statusText}\n` +
                 `Время: ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}`;

    return this.sendMessage(text, 'pickingListItemCollected');
  }

  async notifySupplierBalanceChanged(
    supplierName: string,
    oldBalance: number,
    newBalance: number,
    change: number,
    reason: string
  ): Promise<boolean> {
    const changeText = change > 0 ? `+${change.toLocaleString('ru-RU')}` : change.toLocaleString('ru-RU');
    const text = `💰 <b>Изменение баланса поставщика</b>\n\n` +
                 `Поставщик: <b>${supplierName}</b>\n` +
                 `Старый баланс: ${oldBalance.toLocaleString('ru-RU')} ₽\n` +
                 `Новый баланс: ${newBalance.toLocaleString('ru-RU')} ₽\n` +
                 `Изменение: ${changeText} ₽\n` +
                 `Причина: ${reason}\n` +
                 `Время: ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}`;

    return this.sendMessage(text, 'supplierBalanceChanged');
  }

  async notifyUserCreated(adminName: string, newUserLogin: string, role: string): Promise<boolean> {
    const text = `👤 <b>Создан новый пользователь</b>\n\n` +
                 `Администратор: <b>${adminName}</b>\n` +
                 `Логин: <b>${newUserLogin}</b>\n` +
                 `Роль: <b>${role === 'director' ? 'Директор' : 'Сборщик'}</b>\n` +
                 `Время: ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}`;

    return this.sendMessage(text);
  }

  async notifyUserDeleted(adminName: string, deletedUserLogin: string): Promise<boolean> {
    const text = `🗑️ <b>Удалён пользователь</b>\n\n` +
                 `Администратор: <b>${adminName}</b>\n` +
                 `Логин: <b>${deletedUserLogin}</b>\n` +
                 `Время: ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}`;

    return this.sendMessage(text);
  }

  async notifySupplierCreated(adminName: string, supplierName: string): Promise<boolean> {
    const text = `🏢 <b>Создан новый поставщик</b>\n\n` +
                 `Администратор: <b>${adminName}</b>\n` +
                 `Название: <b>${supplierName}</b>\n` +
                 `Время: ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}`;

    return this.sendMessage(text);
  }

  async notifySupplierDeleted(adminName: string, supplierName: string): Promise<boolean> {
    const text = `🗑️ <b>Удалён поставщик</b>\n\n` +
                 `Администратор: <b>${adminName}</b>\n` +
                 `Название: <b>${supplierName}</b>\n` +
                 `Время: ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}`;

    return this.sendMessage(text);
  }

  async notifyInvoiceDeleted(adminName: string, supplierName: string, amount: number): Promise<boolean> {
    const text = `🗑️ <b>Удалена накладная</b>\n\n` +
                 `Администратор: <b>${adminName}</b>\n` +
                 `Поставщик: <b>${supplierName}</b>\n` +
                 `Сумма: ${amount.toLocaleString('ru-RU')} ₽\n` +
                 `Время: ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}`;

    return this.sendMessage(text, 'invoiceAdded');
  }

  clearCache() {
    this.client = null;
    this.config = null;
  }
}

export default new TelegramService();

