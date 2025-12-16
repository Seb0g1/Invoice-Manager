# 🔒 Настройка HTTPS для davidsklad.ru

## 📋 Требования

- Домен `davidsklad.ru` должен указывать на IP вашего сервера
- Порты 80 и 443 должны быть открыты в файрволе
- Nginx должен быть установлен и настроен

## 🚀 Пошаговая настройка

### Шаг 1: Проверка DNS

```bash
# Проверка, что домен указывает на ваш сервер
nslookup davidsklad.ru
dig davidsklad.ru +short
```

Должен вернуться IP вашего сервера.

### Шаг 2: Проверка файрвола

```bash
# Проверка статуса файрвола
sudo ufw status

# Если файрвол активен, откройте порты
sudo ufw allow 'Nginx Full'
# или
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

### Шаг 3: Установка Certbot

```bash
# Обновление пакетов
sudo apt update

# Установка Certbot
sudo apt install -y certbot python3-certbot-nginx
```

### Шаг 4: Обновление конфигурации Nginx для HTTPS

```bash
# Редактирование конфигурации
sudo nano /etc/nginx/sites-available/davidsklad
```

Замените содержимое на:

```nginx
# Редирект с HTTP на HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name davidsklad.ru www.davidsklad.ru;
    
    # Для проверки домена Let's Encrypt
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    # Редирект на HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# Основной сервер (HTTPS)
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name davidsklad.ru www.davidsklad.ru;

    # SSL сертификаты (будут установлены через Certbot)
    ssl_certificate /etc/letsencrypt/live/davidsklad.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/davidsklad.ru/privkey.pem;
    
    # SSL настройки безопасности
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_stapling on;
    ssl_stapling_verify on;

    # Максимальный размер загружаемых файлов
    client_max_body_size 20M;

    # Логи
    access_log /var/log/nginx/davidsklad-access.log;
    error_log /var/log/nginx/davidsklad-error.log;

    # Статические файлы (uploads)
    location /uploads {
        alias /var/www/davidsklad/backend/uploads;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # API Backend
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Cookie $http_cookie;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Frontend (React приложение)
    location / {
        root /var/www/davidsklad/frontend/dist;
        try_files $uri $uri/ /index.html;
        index index.html;
        
        # Кэширование статических файлов
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Отключение кэширования для index.html
    location = /index.html {
        root /var/www/davidsklad/frontend/dist;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
    }
}
```

Сохраните файл (Ctrl+O, Enter, Ctrl+X).

```bash
# Проверка конфигурации
sudo nginx -t

# Если ошибок нет, перезагрузите nginx
sudo systemctl reload nginx
```

### Шаг 5: Получение SSL сертификата

```bash
# Получение сертификата для домена и www поддомена
sudo certbot --nginx -d davidsklad.ru -d www.davidsklad.ru
```

Следуйте инструкциям:
1. Введите email для уведомлений о продлении сертификата
2. Согласитесь с условиями использования (A)
3. Выберите редирект с HTTP на HTTPS (опция 2)

Certbot автоматически:
- Получит сертификат
- Обновит конфигурацию nginx
- Настроит автоматическое обновление

### Шаг 6: Проверка автоматического обновления

```bash
# Проверка, что автоматическое обновление настроено
sudo certbot renew --dry-run
```

Если команда выполнилась успешно, сертификат будет автоматически обновляться.

### Шаг 7: Обновление .env файла

```bash
cd /var/www/davidsklad/backend
nano .env
```

Измените `FRONTEND_URL` на HTTPS:
```env
FRONTEND_URL=https://davidsklad.ru
COOKIE_DOMAIN=davidsklad.ru
```

Сохраните файл.

### Шаг 8: Перезапуск backend

```bash
# Перезапуск приложения
pm2 restart davidsklad-backend

# Проверка логов
pm2 logs davidsklad-backend --lines 20
```

В логах должно быть:
```
Cookie установлена: { secure: true, sameSite: 'strict', domain: 'davidsklad.ru' }
```

## ✅ Проверка

### Шаг 1: Проверка HTTPS

Откройте в браузере:
- https://davidsklad.ru
- https://www.davidsklad.ru

Должен быть зеленый замочек в адресной строке.

### Шаг 2: Проверка редиректа

Откройте:
- http://davidsklad.ru

Должен автоматически перенаправить на HTTPS.

### Шаг 3: Проверка SSL сертификата

```bash
# Проверка сертификата через командную строку
openssl s_client -connect davidsklad.ru:443 -servername davidsklad.ru < /dev/null 2>/dev/null | openssl x509 -noout -dates
```

Или используйте онлайн-сервисы:
- https://www.ssllabs.com/ssltest/analyze.html?d=davidsklad.ru
- https://www.sslshopper.com/ssl-checker.html#hostname=davidsklad.ru

## 🔄 Автоматическое обновление сертификата

Certbot автоматически настроит обновление через systemd timer. Проверьте:

```bash
# Проверка таймера
sudo systemctl status certbot.timer

# Просмотр логов обновления
sudo journalctl -u certbot.timer
```

## 🛠️ Ручное обновление (если нужно)

```bash
# Обновление всех сертификатов
sudo certbot renew

# Обновление с перезагрузкой nginx
sudo certbot renew --reload-nginx
```

## 🆘 Решение проблем

### Проблема 1: Ошибка "Failed to obtain certificate"

**Причины:**
- Домен не указывает на сервер
- Порты 80/443 закрыты
- Nginx не запущен

**Решение:**
```bash
# Проверка DNS
nslookup davidsklad.ru

# Проверка портов
sudo netstat -tlnp | grep -E ':(80|443)'

# Проверка nginx
sudo systemctl status nginx
```

### Проблема 2: Сертификат не обновляется автоматически

```bash
# Проверка таймера
sudo systemctl status certbot.timer

# Включение таймера
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

### Проблема 3: Ошибка "Too many requests"

Let's Encrypt имеет лимит: 5 сертификатов на домен в неделю.

**Решение:** Подождите или используйте `--staging` для тестирования:
```bash
sudo certbot --nginx -d davidsklad.ru -d www.davidsklad.ru --staging
```

## 📋 Быстрая команда (все сразу)

```bash
# Установка Certbot
sudo apt update && sudo apt install -y certbot python3-certbot-nginx

# Открытие портов
sudo ufw allow 'Nginx Full'

# Получение сертификата (Certbot автоматически обновит nginx)
sudo certbot --nginx -d davidsklad.ru -d www.davidsklad.ru

# Обновление .env
cd /var/www/davidsklad/backend
sed -i 's|FRONTEND_URL=.*|FRONTEND_URL=https://davidsklad.ru|g' .env
echo "COOKIE_DOMAIN=davidsklad.ru" >> .env

# Перезапуск backend
pm2 restart davidsklad-backend

# Проверка
sudo certbot renew --dry-run
```

## 🔒 Дополнительные настройки безопасности

### HSTS (HTTP Strict Transport Security)

Добавьте в конфигурацию nginx (в секцию HTTPS server):

```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

### Безопасные заголовки

```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "no-referrer-when-downgrade" always;
```

---

**После выполнения:** Сайт будет работать по HTTPS с автоматическим обновлением сертификата! ✅

