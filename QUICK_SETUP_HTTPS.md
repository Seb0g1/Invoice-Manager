# ⚡ Быстрая настройка HTTPS для davidsklad.ru

## 🚀 Все одной командой

```bash
# 1. Установка Certbot
sudo apt update && sudo apt install -y certbot python3-certbot-nginx

# 2. Открытие портов
sudo ufw allow 'Nginx Full'

# 3. Получение SSL сертификата (Certbot автоматически настроит nginx)
sudo certbot --nginx -d davidsklad.ru -d www.davidsklad.ru

# 4. Обновление .env для HTTPS
cd /var/www/davidsklad/backend
sed -i 's|FRONTEND_URL=.*|FRONTEND_URL=https://davidsklad.ru|g' .env
grep -q "COOKIE_DOMAIN" .env || echo "COOKIE_DOMAIN=davidsklad.ru" >> .env

# 5. Перезапуск backend
pm2 restart davidsklad-backend

# 6. Проверка автоматического обновления
sudo certbot renew --dry-run
```

## 📋 Пошагово

### Шаг 1: Установка Certbot

```bash
sudo apt update
sudo apt install -y certbot python3-certbot-nginx
```

### Шаг 2: Открытие портов

```bash
sudo ufw allow 'Nginx Full'
```

### Шаг 3: Получение SSL сертификата

```bash
sudo certbot --nginx -d davidsklad.ru -d www.davidsklad.ru
```

**Следуйте инструкциям:**
1. Введите email для уведомлений
2. Согласитесь с условиями (A)
3. Выберите редирект с HTTP на HTTPS (опция 2)

Certbot автоматически:
- ✅ Получит сертификат
- ✅ Обновит конфигурацию nginx
- ✅ Настроит автоматическое обновление

### Шаг 4: Обновление .env

```bash
cd /var/www/davidsklad/backend
nano .env
```

Измените:
```env
FRONTEND_URL=https://davidsklad.ru
COOKIE_DOMAIN=davidsklad.ru
```

### Шаг 5: Перезапуск backend

```bash
pm2 restart davidsklad-backend
```

## ✅ Проверка

1. Откройте https://davidsklad.ru - должен быть зеленый замочек 🔒
2. Откройте http://davidsklad.ru - должен автоматически перенаправить на HTTPS

## 🔄 Автоматическое обновление

Сертификат будет автоматически обновляться каждые 90 дней. Проверка:

```bash
sudo certbot renew --dry-run
```

---

**Подробная инструкция:** см. `SETUP_HTTPS.md`

