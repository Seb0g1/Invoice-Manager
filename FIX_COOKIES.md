# 🍪 Исправление проблем с Cookies и авторизацией

## Проблема: 401 после входа

Если вы входите в систему, но всё равно получаете 401, проблема в cookies.

## Быстрое решение

### Шаг 1: Обновите код на сервере

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
NODE_ENV=production
```

### Шаг 3: Очистите cookies в браузере

1. **F12** → **Application** → **Cookies** → **http://david.sakoo.ru**
2. Удалите все cookies
3. Обновите страницу (**Ctrl+F5**)

### Шаг 4: Войдите снова

1. Перейдите на http://david.sakoo.ru/login
2. Введите: `director` / `12345`
3. Нажмите "Войти"

### Шаг 5: Проверьте cookies

После входа:
- **F12** → **Application** → **Cookies**
- Должна быть cookie `token` с значением

## Диагностика

### Проверка 1: Cookies устанавливаются?

После входа откройте DevTools → Network → найдите запрос `/api/auth/login` → Headers → Response Headers

Должна быть строка:
```
Set-Cookie: token=...; HttpOnly; SameSite=Lax; Max-Age=604800
```

### Проверка 2: Cookies отправляются?

Откройте DevTools → Network → найдите запрос `/api/auth/me` → Headers → Request Headers

Должна быть строка:
```
Cookie: token=...
```

### Проверка 3: Backend получает cookies?

На сервере проверьте логи:
```bash
pm2 logs invoice-backend --lines 50
```

Ищите ошибки авторизации.

## Проблемы и решения

### Проблема 1: Cookies не устанавливаются

**Причина:** Неправильные настройки cookies в backend.

**Решение:**
1. Убедитесь, что код обновлён (см. Шаг 1)
2. Проверьте, что `FRONTEND_URL=http://david.sakoo.ru` в `.env`
3. Перезапустите backend

### Проблема 2: Cookies блокируются браузером

**Причина:** Настройки приватности браузера.

**Решение:**
- Отключите блокировку cookies для сайта
- Попробуйте другой браузер
- Проверьте настройки приватности

### Проблема 3: SameSite cookie errors

**Причина:** Браузер блокирует cookies из-за SameSite.

**Решение:**
- Код уже исправлен (SameSite: 'lax' для HTTP)
- Обновите backend (см. Шаг 1)

### Проблема 4: Cookies не передаются через Nginx

**Причина:** Nginx не передаёт cookies правильно.

**Решение:**
Проверьте конфигурацию Nginx. Должно быть:
```nginx
location /api {
    proxy_pass http://localhost:5000;
    proxy_set_header Cookie $http_cookie;
    proxy_set_header Host $host;
    ...
}
```

## Полная переустановка (если ничего не помогает)

```bash
cd /var/www/david-warehouse

# Остановите backend
pm2 delete invoice-backend

# Обновите код
git pull origin main

# Пересоберите
cd backend
rm -rf node_modules dist
npm install
npm run build

# Запустите через скрипт
cd ..
chmod +x setup-pm2.sh
./setup-pm2.sh
```

## Проверка после исправления

1. ✅ Очистите cookies
2. ✅ Войдите в систему
3. ✅ Проверьте, что cookie `token` установлена
4. ✅ Проверьте, что нет ошибок 401 после входа
5. ✅ Обновите страницу - должны остаться залогиненным

## Важно

- **401 до входа** = нормально ✅
- **401 после входа** = проблема с cookies ❌
- **Cookie не устанавливается** = проблема в backend ❌
- **Cookie устанавливается, но не отправляется** = проблема в браузере/Nginx ❌

