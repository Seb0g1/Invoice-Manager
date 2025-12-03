/**
 * Скрипт для получения Google OAuth2 Refresh Token
 * 
 * Использование:
 * 1. Убедитесь, что в .env файле указаны GOOGLE_CLIENT_ID и GOOGLE_CLIENT_SECRET
 * 2. Запустите: npm run get-google-token (или ts-node scripts/get-google-refresh-token.ts)
 * 3. Откройте URL, который будет выведен в консоль
 * 4. Авторизуйтесь - код будет получен автоматически
 * 5. Скопируйте полученный refresh_token в .env файл
 * 
 * Скрипт автоматически запускает локальный сервер для получения кода авторизации
 */

import { google } from 'googleapis';
import * as readline from 'readline';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as http from 'http';
import * as url from 'url';

// Загружаем переменные окружения
dotenv.config({ path: path.join(__dirname, '../.env') });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query: string): Promise<string> {
  return new Promise(resolve => rl.question(query, resolve));
}

/**
 * Запускает локальный HTTP сервер для получения authorization code
 */
function startLocalServer(port: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (!req.url) {
        res.writeHead(400);
        res.end('Bad Request');
        return;
      }

      const parsedUrl = url.parse(req.url, true);
      const code = parsedUrl.query.code as string;
      const error = parsedUrl.query.error as string;

      if (error) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <html>
            <head><title>Ошибка авторизации</title></head>
            <body style="font-family: Arial; padding: 20px; text-align: center;">
              <h1 style="color: red;">Ошибка авторизации</h1>
              <p>${error}</p>
              <p>Вы можете закрыть это окно.</p>
            </body>
          </html>
        `);
        server.close();
        reject(new Error(`Ошибка авторизации: ${error}`));
        return;
      }

      if (code) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <html>
            <head><title>Успешно!</title></head>
            <body style="font-family: Arial; padding: 20px; text-align: center;">
              <h1 style="color: green;">✅ Авторизация успешна!</h1>
              <p>Код получен. Вы можете закрыть это окно и вернуться в консоль.</p>
              <p>Скрипт продолжит работу автоматически...</p>
            </body>
          </html>
        `);
        server.close();
        resolve(code);
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <html>
            <head><title>Ожидание авторизации</title></head>
            <body style="font-family: Arial; padding: 20px; text-align: center;">
              <h1>Ожидание авторизации...</h1>
              <p>Пожалуйста, авторизуйтесь в браузере.</p>
            </body>
          </html>
        `);
      }
    });

    server.listen(port, () => {
      console.log(`\n🌐 Локальный сервер запущен на http://localhost:${port}`);
      console.log('   Готов к получению кода авторизации...\n');
    });

    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        reject(new Error(`Порт ${port} уже занят. Закройте другие приложения или измените порт.`));
      } else {
        reject(err);
      }
    });

    // Таймаут через 5 минут
    setTimeout(() => {
      server.close();
      reject(new Error('Таймаут: код авторизации не получен в течение 5 минут'));
    }, 5 * 60 * 1000);
  });
}

async function getRefreshToken() {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/google/oauth2callback';

    if (!clientId || !clientSecret) {
      console.error('❌ Ошибка: GOOGLE_CLIENT_ID и GOOGLE_CLIENT_SECRET должны быть указаны в .env файле');
      console.log('\nДобавьте в backend/.env:');
      console.log('GOOGLE_CLIENT_ID=your_client_id');
      console.log('GOOGLE_CLIENT_SECRET=your_client_secret');
      console.log('GOOGLE_REDIRECT_URI=http://localhost:5000/api/google/oauth2callback');
      process.exit(1);
    }

    console.log('🔧 Настройка OAuth2 клиента...');
    console.log(`   Client ID: ${clientId.substring(0, 20)}...`);
    console.log(`   Redirect URI: ${redirectUri}\n`);

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    // Генерируем URL для авторизации
    const scopes = [
      'https://www.googleapis.com/auth/spreadsheets', // Для работы с Google Sheets
    ];

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline', // Важно для получения refresh token
      scope: scopes,
      prompt: 'consent' // Принудительно запрашиваем согласие для получения refresh token
    });

    // Используем локальный порт для получения кода
    const localPort = 5000;
    const localRedirectUri = `http://localhost:${localPort}/api/google/callback`;
    
    console.log('\n⚠️  ВАЖНО: Убедитесь, что в Google Cloud Console добавлен redirect URI:');
    console.log(`   ${localRedirectUri}\n`);
    console.log('Если этого URI нет в Google Cloud Console, добавьте его сейчас:');
    console.log('1. Откройте: https://console.cloud.google.com/apis/credentials');
    console.log('2. Найдите ваш OAuth 2.0 Client ID');
    console.log('3. Нажмите на него для редактирования');
    console.log('4. В разделе "Authorized redirect URIs" добавьте:');
    console.log(`   ${localRedirectUri}`);
    console.log('5. Сохраните изменения\n');
    
    const continueAnswer = await question('Добавили redirect URI в Google Cloud Console? (y/n): ');
    if (continueAnswer.toLowerCase() !== 'y' && continueAnswer.toLowerCase() !== 'yes' && continueAnswer.toLowerCase() !== 'да') {
      console.log('\n❌ Пожалуйста, сначала добавьте redirect URI в Google Cloud Console и запустите скрипт снова.');
      process.exit(1);
    }
    
    // Создаем новый OAuth2 клиент с локальным redirect URI
    const localOAuth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      localRedirectUri
    );

    const localAuthUrl = localOAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    });

    console.log('📋 Инструкция:');
    console.log('1. Откройте следующий URL в браузере:');
    console.log('\n' + '='.repeat(80));
    console.log(localAuthUrl);
    console.log('='.repeat(80) + '\n');
    console.log('2. Войдите в свой Google аккаунт');
    console.log('3. Разрешите доступ приложению');
    console.log('4. После авторизации код будет получен автоматически');
    console.log('\n⏳ Ожидание авторизации...\n');

    // Запускаем локальный сервер для получения кода
    let code: string;
    try {
      code = await startLocalServer(localPort);
      console.log('✅ Код авторизации получен!\n');
    } catch (error: any) {
      if (error.message.includes('EADDRINUSE')) {
        console.error('❌ Ошибка:', error.message);
        console.log('\n💡 Решение:');
        console.log('1. Закройте другие приложения, использующие порт 5000');
        console.log('2. Или измените порт в скрипте (строка: const localPort = 5000)');
        console.log('3. Или используйте ручной ввод кода (см. альтернативный метод в документации)');
      } else {
        console.error('❌ Ошибка получения кода:', error.message);
      }
      process.exit(1);
    }

    // Используем локальный OAuth2 клиент для обмена кода
    const oauth2ClientForToken = localOAuth2Client;

    console.log('🔄 Обмениваем код на токены...');

    const { tokens } = await oauth2ClientForToken.getToken(code.trim());

    if (!tokens.refresh_token) {
      console.error('❌ Ошибка: Refresh token не получен');
      console.log('\nВозможные причины:');
      console.log('1. Вы уже авторизовали это приложение ранее (Google не выдает refresh token повторно)');
      console.log('2. В OAuth consent screen не включен параметр "offline access"');
      console.log('\nРешение:');
      console.log('1. Отзовите доступ приложения: https://myaccount.google.com/permissions');
      console.log('2. Запустите скрипт снова');
      console.log('3. Или используйте параметр prompt: "consent" (уже включен в скрипт)');
      
      if (tokens.access_token) {
        console.log('\n✅ Access token получен, но refresh token отсутствует');
        console.log('Текущие токены:', JSON.stringify(tokens, null, 2));
      }
      
      process.exit(1);
    }

    console.log('\n✅ Успешно получены токены!');
    console.log('\n' + '='.repeat(80));
    console.log('Добавьте следующую строку в ваш backend/.env файл:');
    console.log('='.repeat(80));
    console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
    console.log('='.repeat(80) + '\n');

    if (tokens.access_token) {
      console.log('📝 Дополнительная информация:');
      console.log(`   Access Token: ${tokens.access_token.substring(0, 20)}...`);
      console.log(`   Refresh Token: ${tokens.refresh_token.substring(0, 20)}...`);
      console.log(`   Expiry Date: ${tokens.expiry_date ? new Date(tokens.expiry_date).toLocaleString() : 'N/A'}\n`);
    }

    console.log('✅ Готово! Теперь можно использовать Google Sheets API');
    
  } catch (error: any) {
    console.error('\n❌ Ошибка:', error.message);
    
    if (error.code === 'invalid_grant') {
      console.log('\nВозможные причины:');
      console.log('1. Код авторизации истек (коды действительны только несколько минут)');
      console.log('2. Код уже был использован');
      console.log('3. Неправильный redirect URI');
      console.log('\nРешение: Запустите скрипт снова и получите новый код');
    } else if (error.response) {
      console.log('Детали ошибки:', JSON.stringify(error.response.data, null, 2));
    }
    
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Запускаем скрипт
getRefreshToken();

