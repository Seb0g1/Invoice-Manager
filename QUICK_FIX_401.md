# ⚡ Быстрое решение 401 Unauthorized

## Это нормально!

**401 Unauthorized** означает, что вы **не залогинены**. Это не ошибка!

## Что делать

### 1. Откройте страницу входа

Перейдите на: **http://david.sakoo.ru/login**

### 2. Войдите в систему

**Учётные данные:**
- **Логин:** `director`
- **Пароль:** `CGJ-Ge-90`

### 3. После входа ошибки 401 исчезнут

## Если не можете войти

### Шаг 1: Обновите backend на сервере

```bash
cd /var/www/david-warehouse
git pull origin main
cd backend
npm run build
pm2 restart invoice-backend
```

### Шаг 2: Очистите cookies в браузере

1. Нажмите **F12** (DevTools)
2. **Application** → **Cookies** → **http://david.sakoo.ru**
3. Удалите все cookies
4. Обновите страницу (**Ctrl+F5**)

### Шаг 3: Попробуйте войти снова

1. Перейдите на http://david.sakoo.ru/login
2. Введите: `director` / `CGJ-Ge-90`
3. Нажмите "Войти"

### Шаг 4: Проверьте cookies

После входа:
- **F12** → **Application** → **Cookies**
- Должна быть cookie `token`

Если cookie есть, но всё равно 401:
- Проверьте логи: `pm2 logs invoice-backend`
- Убедитесь, что `FRONTEND_URL=http://david.sakoo.ru` в `.env`

## Проверка на сервере

```bash
# 1. Проверьте, что backend запущен
pm2 status

# 2. Проверьте логи
pm2 logs invoice-backend --lines 20

# 3. Проверьте .env
cd /var/www/david-warehouse/backend
cat .env | grep FRONTEND_URL
# Должно быть: FRONTEND_URL=http://david.sakoo.ru

# 4. Если изменили .env, перезапустите
pm2 restart invoice-backend
```

## Если ничего не помогает

```bash
cd /var/www/david-warehouse

# Полная переустановка backend
cd backend
pm2 delete invoice-backend
rm -rf node_modules dist
npm install
npm run build
cd ..
./setup-pm2.sh
```

## Важно

- **401 до входа** = нормально ✅
- **401 после входа** = проблема ❌
- **502 Bad Gateway** = backend не запущен ❌

Если после входа всё равно 401, проверьте логи backend!

