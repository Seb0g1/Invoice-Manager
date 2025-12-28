import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

class GoogleSheetsService {
  private oauth2Client: OAuth2Client | null = null;

  /**
   * Инициализация OAuth2 клиента
   */
  initialize(): void {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/google/oauth2callback';
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

    if (!clientId || !clientSecret) {
      console.warn('[GoogleSheets] GOOGLE_CLIENT_ID и GOOGLE_CLIENT_SECRET не настроены');
      return;
    }

    this.oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    if (refreshToken) {
      this.oauth2Client.setCredentials({
        refresh_token: refreshToken
      });
    } else {
      console.warn('[GoogleSheets] GOOGLE_REFRESH_TOKEN не настроен. Используйте OAuth2 flow для получения токена.');
    }
  }

  /**
   * Получить OAuth2 клиент
   */
  getAuthClient(): OAuth2Client {
    if (!this.oauth2Client) {
      this.initialize();
    }
    if (!this.oauth2Client) {
      throw new Error('Google Sheets API не настроен. Проверьте переменные окружения.');
    }
    return this.oauth2Client;
  }

  /**
   * Создать Google таблицу с шаблоном для листа сборки
   */
  async createPickingListSheet(name: string, items: Array<{
    name: string;
    article?: string;
    quantity: number;
    price?: number;
    supplier?: string;
    collected?: boolean;
    paid?: boolean;
  }>): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
    const auth = this.getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });

    // Создаем новую таблицу
    const createResponse = await sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title: name
        },
        sheets: [{
          properties: {
            title: 'Лист сборки',
            gridProperties: {
              rowCount: 1000,
              columnCount: 10
            }
          }
        }]
      }
    });

    const spreadsheetId = createResponse.data.spreadsheetId;
    if (!spreadsheetId) {
      throw new Error('Не удалось создать таблицу');
    }

    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

    // Формируем данные для заполнения
    const headers = [
      '№',
      'Наименование',
      'Артикул',
      'Количество',
      'Цена',
      'Поставщик',
      'Собрано',
      'Оплачено',
      'Примечание'
    ];

    const rows = items.map((item, index) => [
      (index + 1).toString(),
      item.name || '',
      item.article || '',
      item.quantity.toString(),
      item.price ? item.price.toString() : '',
      item.supplier || '',
      item.collected ? 'Да' : 'Нет',
      item.paid ? 'Да' : 'Нет',
      ''
    ]);

    // Заполняем таблицу данными
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Лист сборки!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [headers, ...rows]
      }
    });

    // Форматируем заголовки (жирный, закрепление)
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          // Форматирование заголовков
          {
            repeatCell: {
              range: {
                sheetId: 0,
                startRowIndex: 0,
                endRowIndex: 1,
                startColumnIndex: 0,
                endColumnIndex: headers.length
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: {
                    red: 0.9,
                    green: 0.9,
                    blue: 0.9
                  },
                  textFormat: {
                    bold: true
                  }
                }
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat)'
            }
          },
          // Закрепление первой строки
          {
            updateSheetProperties: {
              properties: {
                sheetId: 0,
                gridProperties: {
                  frozenRowCount: 1
                }
              },
              fields: 'gridProperties.frozenRowCount'
            }
          },
          // Автоматическое изменение ширины колонок
          {
            autoResizeDimensions: {
              dimensions: {
                sheetId: 0,
                dimension: 'COLUMNS',
                startIndex: 0,
                endIndex: headers.length
              }
            }
          }
        ]
      }
    });

    return {
      spreadsheetId,
      spreadsheetUrl
    };
  }

  /**
   * Обновить данные в существующей таблице
   */
  async updatePickingListSheet(
    spreadsheetId: string,
    items: Array<{
      name: string;
      article?: string;
      quantity: number;
      price?: number;
      supplier?: string;
      collected?: boolean;
      paid?: boolean;
    }>
  ): Promise<void> {
    const auth = this.getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });

    const headers = [
      '№',
      'Наименование',
      'Артикул',
      'Количество',
      'Цена',
      'Поставщик',
      'Собрано',
      'Оплачено',
      'Примечание'
    ];

    const rows = items.map((item, index) => [
      (index + 1).toString(),
      item.name || '',
      item.article || '',
      item.quantity.toString(),
      item.price ? item.price.toString() : '',
      item.supplier || '',
      item.collected ? 'Да' : 'Нет',
      item.paid ? 'Да' : 'Нет',
      ''
    ]);

    // Очищаем старые данные (кроме заголовков)
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: 'Лист сборки!A2:I1000'
    });

    // Заполняем новыми данными
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Лист сборки!A2',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: rows
      }
    });
  }
}

export default new GoogleSheetsService();

