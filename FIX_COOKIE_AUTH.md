# 🍪 Исправление проблемы с cookies и авторизацией

## Проблема

После входа пользователь снова перенаправляется на страницу авторизации. В логах:
```
Cookie установлена: { secure: true, sameSite: 'strict', domain: 'не указан' }
Auth middleware - cookies: { hasToken: false, tokenLength: 0, allCookies: [], headers: 'missing' }
```

**Причина:** Cookie устанавливается с `secure: true`, но сайт работает по HTTP (не HTTPS). Браузер не отправляет cookie с флагом `secure` по HTTP соединению.

## 🔧 Решение

### Вариант 1: Исправить настройки cookie для HTTP (быстрое решение)

```bash
# 1. Проверьте FRONTEND_URL в .env
cd /var/www/davidsklad/backend
cat .env | grep FRONTEND_URL
```

Должно быть:
```env
FRONTEND_URL=http://davidsklad.ru
```

Если указан `https://`, измените на `http://` (если SSL еще не настроен).

```bash
# 2. Добавьте COOKIE_DOMAIN (опционально, но рекомендуется)
nano .env
```

Добавьте:
```env
COOKIE_DOMAIN=davidsklad.ru
```

```bash
# 3. Перезапустите backend
pm2 restart davidsklad-backend

# 4. Проверьте логи
pm2 logs davidsklad-backend --lines 20
```

### Вариант 2: Настроить HTTPS (рекомендуется для продакшена)

```bash
# 1. Установите SSL сертификат
sudo certbot --nginx -d davidsklad.ru -d www.davidsklad.ru
```

После установки SSL:
- `FRONTEND_URL` должен быть `https://davidsklad.ru`
- Cookie будет работать с `secure: true`

### Вариант 3: Исправить код для правильной работы с HTTP

Если нужно временно работать по HTTP, проверьте код в `backend/src/controllers/authController.ts`:

```typescript
const cookieOptions: any = {
  httpOnly: true,
  secure: process.env.FRONTEND_URL?.startsWith('https://') || false,
  sameSite: process.env.FRONTEND_URL?.startsWith('https://') ? 'strict' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/'
};

if (process.env.COOKIE_DOMAIN) {
  cookieOptions.domain = process.env.COOKIE_DOMAIN;
}
```

Убедитесь, что:
1. `FRONTEND_URL=http://davidsklad.ru` (без https)
2. `COOKIE_DOMAIN=davidsklad.ru` (опционально, но рекомендуется)

## ✅ Проверка

### Шаг 1: Проверка .env файла

```bash
cd /var/www/davidsklad/backend
cat .env | grep -E "FRONTEND_URL|COOKIE_DOMAIN"
```

Должно быть:
```env
FRONTEND_URL=http://davidsklad.ru
COOKIE_DOMAIN=davidsklad.ru
```

### Шаг 2: Проверка в браузере

1. Откройте DevTools (F12)
2. Перейдите на вкладку **Application** (Chrome) или **Storage** (Firefox)
3. Откройте **Cookies** → `http://davidsklad.ru`
4. После входа должна появиться cookie `token`

### Шаг 3: Проверка запросов

1. Откройте DevTools → Network
2. Выполните вход
3. Проверьте запрос `/api/auth/login` - в Response Headers должна быть `Set-Cookie`
4. Проверьте запрос `/api/auth/me` - в Request Headers должна быть `Cookie: token=...`

## 🔍 Диагностика

### Проверка CORS настроек

Убедитесь, что в `backend/src/index.ts`:

```typescript
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
app.use(cors({
  origin: frontendUrl,
  credentials: true,  // ВАЖНО
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

### Проверка nginx конфигурации

Убедитесь, что nginx передает cookies:

```nginx
location /api {
    proxy_pass http://localhost:5000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Cookie $http_cookie;  # ВАЖНО: передача cookies
    proxy_cache_bypass $http_upgrade;
    proxy_read_timeout 300s;
    proxy_connect_timeout 75s;
}
```

## 🚀 Быстрое решение

```bash
# 1. Обновите .env
cd /var/www/davidsklad/backend
nano .env
```

Убедитесь, что есть:
```env
FRONTEND_URL=http://davidsklad.ru
COOKIE_DOMAIN=davidsklad.ru
```

```bash
# 2. Перезапустите backend
pm2 restart davidsklad-backend

# 3. Очистите cookies в браузере и попробуйте войти снова
```

## 🔒 Настройка HTTPS (рекомендуется)

После настройки HTTPS:

```bash
# 1. Установите SSL
sudo certbot --nginx -d davidsklad.ru -d www.davidsklad.ru

# 2. Обновите .env
cd /var/www/davidsklad/backend
nano .env
```

Измените:
```env
FRONTEND_URL=https://davidsklad.ru
```

```bash
# 3. Перезапустите backend
pm2 restart davidsklad-backend
```

---

**После исправления:** Cookie должна устанавливаться и отправляться правильно, авторизация должна работать! ✅

