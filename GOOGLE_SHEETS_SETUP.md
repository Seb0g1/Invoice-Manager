# Настройка Google Sheets API

Эта инструкция поможет настроить интеграцию с Google Sheets API для автоматического создания таблиц при создании листов сборки.

## Шаг 1: Создание проекта в Google Cloud Console

1. Перейдите на [Google Cloud Console](https://console.cloud.google.com/)
2. Создайте новый проект или выберите существующий
3. Включите необходимые API:
   - **Google Sheets API**:
     - Перейдите в "APIs & Services" > "Library"
     - Найдите "Google Sheets API"
     - Нажмите "Enable"
   - **Google Drive API** (опционально, для расширенной работы с файлами):
     - В той же библиотеке найдите "Google Drive API"
     - Нажмите "Enable"

## Шаг 2: Создание OAuth 2.0 Credentials

1. Перейдите в "APIs & Services" > "Credentials"
2. Нажмите "Create Credentials" > "OAuth client ID"
3. Если появится запрос на настройку OAuth consent screen:
   - Выберите "External" (для тестирования)
   - Заполните обязательные поля (App name, User support email, Developer contact)
   - Сохраните и продолжите
4. Выберите тип приложения: "Web application"
5. Добавьте Authorized redirect URIs (ОБЯЗАТЕЛЬНО!):
   
   **⚠️ КРИТИЧЕСКИ ВАЖНО:** Точное совпадение URI обязательно! Проверьте:
   - Нет лишних пробелов (ни в начале, ни в конце, ни внутри)
   - Правильный протокол (http, не https для localhost)
   - Правильный порт (5000)
   - Правильный путь (/api/google/callback)
   
   Добавьте ТОЧНО такой URI (скопируйте и вставьте, чтобы избежать опечаток):
   ```
   http://localhost:5000/api/google/callback
   ```
   
   **Как правильно добавить:**
   1. Нажмите "+ ADD URI"
   2. Скопируйте URI выше (Ctrl+C)
   3. Вставьте в поле (Ctrl+V) - НЕ ПЕЧАТАЙТЕ ВРУЧНУЮ!
   4. Проверьте, что нет пробелов
   5. Нажмите "SAVE"
   
   **Пошаговая инструкция:**
   1. В разделе "Authorized redirect URIs" нажмите "+ ADD URI"
   2. Введите: `http://localhost:5000/callback`
   3. Нажмите "SAVE"
   4. Подождите 1-2 минуты для применения изменений
   
   **Дополнительные URI (опционально):**
   - Для OAuth2 Playground: `https://developers.google.com/oauthplayground`
   - Для продакшена: `https://yourdomain.com/api/google/oauth2callback`
   
   **Рекомендация:** Используйте программный метод (см. Шаг 3, Вариант 2) - он проще и не требует настройки OAuth2 Playground
   
   **Важно:** Скрипт автоматически запускает локальный сервер на порту 5000 для получения кода авторизации. Убедитесь, что порт 5000 свободен или измените порт в скрипте.
6. Нажмите "Create"
7. Сохраните **Client ID** и **Client Secret**

## Шаг 3: Получение Refresh Token

### Вариант 1: Использование OAuth2 Playground (быстрый способ, если скрипт не работает)

**Важно:** При использовании OAuth2 Playground нужно использовать специальный redirect URI, который уже настроен в Playground.

**ВАЖНО:** Сначала добавьте redirect URI в Google Cloud Console:
1. Откройте: https://console.cloud.google.com/apis/credentials
2. Найдите ваш OAuth 2.0 Client ID и откройте его
3. В разделе "Authorized redirect URIs" добавьте:
   ```
   https://developers.google.com/oauthplayground
   ```
4. Сохраните изменения и подождите 1-2 минуты

**Затем используйте OAuth2 Playground:**
1. Перейдите на [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)
2. В правом верхнем углу нажмите на иконку настроек (⚙️)
3. Установите флажок "Use your own OAuth credentials"
4. Введите ваш **Client ID** и **Client Secret**
5. В левой панели найдите и выберите следующие scopes:
   - Найдите раздел **"Google Sheets API v4"** (не Drive API!)
   - Выберите: `https://www.googleapis.com/auth/spreadsheets` (для работы с Google Sheets - создание и редактирование таблиц)
   - Опционально, в разделе **"Drive API v3"** выберите: `https://www.googleapis.com/auth/drive.file` (для создания файлов в Drive)
   
   **Важно:** 
   - `https://www.googleapis.com/auth/spreadsheets` находится в разделе **"Google Sheets API v4"**, а не в "Drive API v3"
   - Для создания таблиц достаточно только `https://www.googleapis.com/auth/spreadsheets`
7. Нажмите "Authorize APIs"
8. Войдите в свой Google аккаунт и разрешите доступ
9. Нажмите "Exchange authorization code for tokens"
10. Скопируйте **Refresh token** из правой панели

### Вариант 2: Программный способ (рекомендуется)

Используйте готовый скрипт для получения refresh token:

1. Убедитесь, что в `backend/.env` указаны:
   ```env
   GOOGLE_CLIENT_ID=your_client_id
   GOOGLE_CLIENT_SECRET=your_client_secret
   GOOGLE_REDIRECT_URI=http://localhost:5000/api/google/oauth2callback
   ```

2. Запустите скрипт одним из способов:

   **Способ 1 (рекомендуется для Windows):**
   ```bash
   cd backend
   scripts\get-google-token.bat
   ```
   
   **Способ 2 (если npm работает):**
   ```bash
   cd backend
   npm run get-google-token
   ```
   
   **Способ 3 (напрямую через ts-node):**
   ```bash
   cd backend
   npx ts-node scripts/get-google-refresh-token.ts
   ```
   
   **Если получаете ошибку PowerShell о политике выполнения:**
   - Используйте Способ 1 (bat файл) или Способ 3
   - Или временно измените политику выполнения PowerShell:
     ```powershell
     Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
     ```

3. Скрипт выведет URL для авторизации - откройте его в браузере

4. Войдите в Google аккаунт и разрешите доступ

5. После авторизации вас перенаправит на redirect URI с параметром `code`

6. Скопируйте значение параметра `code` из URL (например: `http://localhost:5000/api/google/oauth2callback?code=4/0Aean...`)

7. Вставьте код в консоль, когда скрипт попросит

8. Скрипт автоматически обменяет код на refresh token и выведет его

9. Скопируйте полученный `GOOGLE_REFRESH_TOKEN` в ваш `backend/.env` файл

**Преимущества этого метода:**
- Не нужно настраивать OAuth2 Playground
- Используется ваш собственный redirect URI
- Автоматизированный процесс
- Подробные инструкции в консоли

## Шаг 4: Настройка переменных окружения

Добавьте следующие переменные в файл `backend/.env`:

```env
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REFRESH_TOKEN=your_refresh_token_here
GOOGLE_REDIRECT_URI=http://localhost:5000/api/google/oauth2callback
```

Для продакшена используйте:

```env
GOOGLE_REDIRECT_URI=https://yourdomain.com/api/google/oauth2callback
```

## Шаг 5: Проверка работы

1. Перезапустите backend сервер
2. Откройте страницу "Листы сборки"
3. Нажмите "Создать лист"
4. Установите флажок "Создать Google таблицу"
5. Введите название таблицы
6. Нажмите "Создать"
7. После создания должна открыться Google таблица в новой вкладке

## Устранение проблем

### Ошибка: "redirect_uri_mismatch" (400)
Эта ошибка возникает, когда redirect URI в запросе не совпадает с зарегистрированным в Google Cloud Console.

**Пошаговое решение:**

1. **Проверьте текущий redirect URI в скрипте:**
   - Откройте `backend/scripts/get-google-refresh-token.ts`
   - Найдите строку: `const localRedirectUri = 'http://localhost:5000/callback';`
   - Запомните этот URI

2. **Проверьте redirect URI в Google Cloud Console:**
   - Откройте: https://console.cloud.google.com/apis/credentials
   - Найдите ваш OAuth 2.0 Client ID
   - Нажмите на него для редактирования
   - В разделе "Authorized redirect URIs" проверьте список

3. **Добавьте правильный URI:**
   - URI должен быть ТОЧНО: `http://localhost:5000/api/google/callback`
   - **ВАЖНО:** Скопируйте URI и вставьте его, не печатайте вручную!
   - Проверьте:
     - ✅ Нет лишних пробелов в начале, конце или внутри URI
     - ✅ Используется `http://` (не `https://` для localhost)
     - ✅ Порт `5000` (не другой)
     - ✅ Путь `/api/google/callback` (именно такой, с `/api/google/`)
   
4. **Сохраните и подождите:**
   - Нажмите "SAVE" в Google Cloud Console
   - Подождите 1-2 минуты (изменения применяются не мгновенно)
   - Закройте и откройте браузер заново (очистите кеш)

5. **Проверьте еще раз:**
   - Убедитесь, что URI добавлен и сохранен
   - Убедитесь, что нет опечаток
   - Попробуйте запустить скрипт снова

**Если ошибка "cannot contain whitespace" повторяется:**
- Убедитесь, что вы КОПИРУЕТЕ URI, а не печатаете вручную
- Проверьте, что в поле нет пробелов (даже невидимых)
- Попробуйте удалить все URI и добавить заново
- Используйте другой браузер или режим инкогнито

**Если ошибка "redirect_uri_mismatch" повторяется:**
- Попробуйте использовать другой порт (например, 8080):
  - Измените в скрипте: `const localPort = 8080;`
  - Добавьте в Google Cloud Console: `http://localhost:8080/api/google/callback`
- Или используйте OAuth2 Playground (см. Вариант 1 в Шаге 3)

### Ошибка: "Google Sheets API не настроен"
- Проверьте, что все переменные окружения установлены
- Убедитесь, что Google Sheets API включен в Google Cloud Console

### Ошибка: "Invalid grant"
- Refresh token мог истечь или быть отозван
- Получите новый refresh token через OAuth2 Playground
- Убедитесь, что при получении токена использовался scope `https://www.googleapis.com/auth/spreadsheets`

### Ошибка: "Access denied"
- Убедитесь, что в OAuth consent screen добавлены тестовые пользователи (если приложение в режиме тестирования)
- Проверьте, что используете правильный Client ID и Client Secret
- Убедитесь, что OAuth consent screen опубликован или добавлены тестовые пользователи

### Таблица не создается
- Проверьте логи backend сервера
- Убедитесь, что refresh token имеет права на создание файлов в Google Drive
- Проверьте, что используется правильный scope при получении refresh token

## Безопасность

⚠️ **Важно:**
- Никогда не коммитьте `.env` файл в репозиторий
- Храните Client Secret и Refresh Token в безопасном месте
- Используйте разные credentials для разработки и продакшена
- Регулярно проверяйте активность в Google Cloud Console

## Дополнительная информация

- [Google Sheets API Documentation](https://developers.google.com/sheets/api)
- [OAuth 2.0 для веб-приложений](https://developers.google.com/identity/protocols/oauth2/web-server)

