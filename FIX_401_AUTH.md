# 🔐 Устранение ошибки 401 Unauthorized

Ошибка **401 Unauthorized** означает, что backend работает, но пользователь не авторизован. Это нормально, если вы не залогинены.

## Важно понимать

**401 - это не ошибка**, если:
- Вы не залогинены
- Страница входа отображается
- После входа всё работает

**401 - это проблема**, если:
- Вы залогинены, но всё равно получаете 401
- Не можете войти в систему
- Cookies не сохраняются

## Проверка

### 1. Откройте страницу входа

Перейдите на: **http://david.sakoo.ru/login**

Должна отобразиться форма входа.

### 2. Попробуйте войти

**Дефолтные учётные данные:**
- **Директор:** `login: director`, `password: CGJ-Ge-90`
- **Сборщик:** `login: collector`, `password: 12345`

### 3. Проверьте Cookies

После входа откройте DevTools (F12) → Application → Cookies → http://david.sakoo.ru

Должна быть cookie с именем `token`.

## Если не можете войти

### Проблема 1: Cookies не сохраняются

**Причина:** Неправильные настройки cookies в backend.

**Решение:**

1. **Обновите код backend** (уже исправлено в последней версии):
   ```bash
   cd /var/www/david-warehouse
   git pull origin main
   cd backend
   npm run build
   pm2 restart invoice-backend
   ```

2. **Проверьте .env:**
   ```bash
   cd /var/www/david-warehouse/backend
   cat .env | grep FRONTEND_URL
   ```
   
   Должно быть: `FRONTEND_URL=http://david.sakoo.ru`

### Проблема 2: Пользователи не созданы

**Проверка:**
```bash
# Подключитесь к MongoDB и проверьте пользователей
# Или перезапустите backend - он создаст дефолтных пользователей
pm2 restart invoice-backend
pm2 logs invoice-backend
```

Должны увидеть:
```
✅ Пользователь director создан
✅ Пользователь collector создан
```

### Проблема 3: Неправильный JWT_SECRET

**Проверка:**
```bash
cd /var/www/david-warehouse/backend
cat .env | grep JWT_SECRET
```

**Решение:**
```bash
nano .env
# Убедитесь, что JWT_SECRET установлен (минимум 32 символа)
# Перезапустите backend
pm2 restart invoice-backend
```

## Исправление настроек Cookies

Если cookies не работают, проверьте настройки в `backend/src/controllers/authController.ts`:

```typescript
res.cookie('token', token, {
  httpOnly: true,
  secure: process.env.FRONTEND_URL?.startsWith('https://') || false,
  sameSite: process.env.FRONTEND_URL?.startsWith('https://') ? 'strict' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  domain: process.env.COOKIE_DOMAIN || undefined
});
```

**Важно:**
- Для HTTP: `secure: false`, `sameSite: 'lax'`
- Для HTTPS: `secure: true`, `sameSite: 'strict'`

## Пошаговое решение

### Шаг 1: Обновите код

```bash
cd /var/www/david-warehouse
git pull origin main
cd backend
npm run build
pm2 restart invoice-backend
```

### Шаг 2: Проверьте .env

```bash
cd /var/www/david-warehouse/backend
nano .env
```

Убедитесь, что:
```env
FRONTEND_URL=http://david.sakoo.ru
JWT_SECRET=your-secret-key-min-32-chars
MONGO_URI=mongodb://gen_user:_*W%264xFfUJP9%2BO@147.45.175.217:27017/default_db?authSource=admin&directConnection=true
PORT=5000
NODE_ENV=production
```

### Шаг 3: Перезапустите backend

```bash
pm2 restart invoice-backend
pm2 logs invoice-backend
```

### Шаг 4: Очистите cookies в браузере

1. Откройте DevTools (F12)
2. Application → Cookies → http://david.sakoo.ru
3. Удалите все cookies
4. Обновите страницу

### Шаг 5: Попробуйте войти

1. Перейдите на http://david.sakoo.ru/login
2. Введите: `director` / `CGJ-Ge-90`
3. Нажмите "Войти"

### Шаг 6: Проверьте cookies

После входа проверьте:
- DevTools → Application → Cookies
- Должна быть cookie `token`

## Проверка работы авторизации

### Тест 1: Проверка без авторизации

```bash
curl http://david.sakoo.ru/api/auth/me
```

Должен вернуть: `{"message":"Не авторизован"}` (401)

### Тест 2: Вход

```bash
curl -X POST http://david.sakoo.ru/api/auth/login \
  -H "Content-Type: application/json" \
   -d '{"login":"director","password":"CGJ-Ge-90"}' \
  -c cookies.txt
```

Должен вернуть: `{"message":"Успешный вход","user":{...}}`

### Тест 3: Проверка с cookies

```bash
curl http://david.sakoo.ru/api/auth/me -b cookies.txt
```

Должен вернуть данные пользователя (200)

## Если всё ещё не работает

### 1. Проверьте логи backend

```bash
pm2 logs invoice-backend --lines 50
```

Ищите ошибки:
- MongoDB connection errors
- JWT errors
- Cookie errors

### 2. Проверьте CORS

Убедитесь, что в `backend/src/index.ts`:
```typescript
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

### 3. Проверьте Nginx

Убедитесь, что Nginx передаёт cookies:
```nginx
proxy_set_header Cookie $http_cookie;
```

### 4. Полная переустановка

```bash
cd /var/www/david-warehouse/backend
pm2 delete invoice-backend
rm -rf node_modules dist
npm install
npm run build
cd ..
./setup-pm2.sh
```

## Частые проблемы

### Cookies блокируются браузером

**Решение:**
- Проверьте настройки приватности браузера
- Отключите блокировку cookies для сайта
- Попробуйте другой браузер

### SameSite cookie errors

**Решение:**
- Обновите код (уже исправлено)
- Перезапустите backend
- Очистите cookies

### JWT Secret не совпадает

**Решение:**
- Убедитесь, что JWT_SECRET одинаковый в .env
- Перезапустите backend
- Выйдите и войдите заново

## Проверка после исправления

1. ✅ Откройте http://david.sakoo.ru/login
2. ✅ Войдите с `director` / `CGJ-Ge-90`
3. ✅ Проверьте, что cookies сохранились
4. ✅ Проверьте, что нет ошибок 401 после входа
5. ✅ Проверьте, что данные загружаются

## Полезные команды

```bash
# Логи backend
pm2 logs invoice-backend

# Перезапуск
pm2 restart invoice-backend

# Проверка .env
cat backend/.env

# Тест API
curl http://david.sakoo.ru/api/auth/me
```

