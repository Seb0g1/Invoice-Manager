# 🍪 Проверка Cookies после входа

## Проблема: 401 после входа

Если вы входите в систему, но всё равно получаете 401, проблема в cookies.

## Быстрая проверка в браузере

### Шаг 1: Откройте DevTools

Нажмите **F12** в браузере

### Шаг 2: Попробуйте войти

1. Перейдите на http://david.sakoo.ru/login
2. Введите: `director` / `CGJ-Ge-90`
3. Нажмите "Войти"

### Шаг 3: Проверьте Network

1. **DevTools** → **Network**
2. Найдите запрос `/api/auth/login`
3. Откройте его → **Headers**

#### Response Headers (должна быть):
```
Set-Cookie: token=...; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800
```

Если `Set-Cookie` нет → проблема в backend

#### Request Headers (для следующего запроса):
```
Cookie: token=...
```

Если `Cookie` нет → проблема в браузере или Nginx

### Шаг 4: Проверьте Application

1. **DevTools** → **Application** → **Cookies** → **http://david.sakoo.ru**
2. Должна быть cookie `token`

Если cookie нет → проблема в настройках cookies

## Диагностика на сервере

### 1. Проверьте логи backend

```bash
pm2 logs invoice-backend --lines 50
```

Ищите:
- `Cookie установлена:` - должна быть при входе
- `Login error:` - ошибки при входе

### 2. Проверьте .env

```bash
cd /var/www/david-warehouse/backend
cat .env | grep -E 'FRONTEND_URL|COOKIE_DOMAIN'
```

Должно быть:
```
FRONTEND_URL=http://david.sakoo.ru
```

### 3. Проверьте Nginx

```bash
sudo cat /etc/nginx/sites-available/david-warehouse | grep -A 10 "location /api"
```

Должно быть:
```nginx
location /api {
    proxy_pass http://localhost:5000;
    proxy_set_header Cookie $http_cookie;
    ...
}
```

### 4. Тест входа через curl

```bash
cd /var/www/david-warehouse
./diagnose-auth.sh
```

## Решения

### Решение 1: Cookies не устанавливаются

**Причина:** Неправильные настройки cookies в backend

**Решение:**
```bash
cd /var/www/david-warehouse/backend
# Проверьте .env
cat .env | grep FRONTEND_URL
# Должно быть: FRONTEND_URL=http://david.sakoo.ru

# Перезапустите backend
pm2 restart invoice-backend
```

### Решение 2: Cookies не передаются через Nginx

**Причина:** Nginx не передаёт cookies

**Решение:**
```bash
cd /var/www/david-warehouse
sudo cp nginx-david.sakoo.ru.conf /etc/nginx/sites-available/david-warehouse
sudo nginx -t
sudo systemctl reload nginx
```

### Решение 3: Браузер блокирует cookies

**Причина:** Настройки приватности браузера

**Решение:**
- Отключите блокировку cookies для сайта
- Попробуйте другой браузер
- Очистите cookies и попробуйте снова

### Решение 4: Пароль не изменён

**Причина:** Пароль в базе данных не обновлён

**Решение:**
```bash
cd /var/www/david-warehouse
./change-director-password.sh
```

## Проверка после исправления

1. ✅ Очистите cookies в браузере
2. ✅ Войдите в систему: `director` / `CGJ-Ge-90`
3. ✅ Проверьте, что cookie `token` установлена
4. ✅ Проверьте, что нет ошибок 401 после входа
5. ✅ Обновите страницу - должны остаться залогиненным

## Важно

- **401 до входа** = нормально ✅
- **401 после входа** = проблема с cookies ❌
- **Cookie не устанавливается** = проблема в backend ❌
- **Cookie устанавливается, но не отправляется** = проблема в браузере/Nginx ❌

