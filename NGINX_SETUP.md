# 🌐 Настройка домена david.sakoo.ru

## Пошаговая инструкция

### 1. Подготовка проекта на сервере

```bash
# Перейдите в директорию проекта
cd /var/www/david-warehouse

# Убедитесь, что проект собран
cd backend
npm run build

cd ../frontend
npm run build
```

**Важно:** Убедитесь, что директория `frontend/dist` существует и содержит собранные файлы.

### 2. Настройка DNS

Убедитесь, что DNS запись для `david.sakoo.ru` указывает на IP-адрес вашего сервера:

```
A запись: david.sakoo.ru → IP_ВАШЕГО_СЕРВЕРА
```

### 3. Установка и настройка Nginx

```bash
# Установка Nginx (если еще не установлен)
sudo apt update
sudo apt install nginx -y

# Проверка статуса
sudo systemctl status nginx
```

### 4. Копирование конфигурации

```bash
# Перейдите в директорию проекта
cd /var/www/david-warehouse

# Копирование конфигурации Nginx
sudo cp nginx-david.sakoo.ru.conf /etc/nginx/sites-available/david-warehouse

# Или создайте файл вручную
sudo nano /etc/nginx/sites-available/david-warehouse
```

Вставьте следующую конфигурацию:

```nginx
server {
    listen 80;
    server_name david.sakoo.ru;

    # Frontend
    location / {
        root /var/www/david-warehouse/frontend/dist;
        try_files $uri $uri/ /index.html;
        index index.html;
        
        # Кэширование статических файлов
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Загрузка файлов
    location /uploads {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Логи
    access_log /var/log/nginx/david-warehouse-access.log;
    error_log /var/log/nginx/david-warehouse-error.log;
}
```

### 5. Активация конфигурации

```bash
# Создание символической ссылки
sudo ln -s /etc/nginx/sites-available/david-warehouse /etc/nginx/sites-enabled/

# Проверка конфигурации
sudo nginx -t

# Если проверка прошла успешно, перезагрузите Nginx
sudo systemctl reload nginx
```

### 6. Проверка прав доступа

```bash
# Убедитесь, что Nginx может читать файлы
sudo chown -R www-data:www-data /var/www/david-warehouse/frontend/dist
sudo chmod -R 755 /var/www/david-warehouse/frontend/dist
```

### 7. Настройка Backend

Убедитесь, что в файле `backend/.env` указан правильный FRONTEND_URL:

```env
FRONTEND_URL=http://david.sakoo.ru
```

Или для HTTPS (после настройки SSL):

```env
FRONTEND_URL=https://david.sakoo.ru
```

### 8. Перезапуск Backend

```bash
# Если используете PM2
pm2 restart invoice-backend

# Если используете systemd
sudo systemctl restart invoice-manager
```

### 9. Настройка SSL (HTTPS) - опционально, но рекомендуется

```bash
# Установка Certbot
sudo apt install certbot python3-certbot-nginx -y

# Получение SSL сертификата
sudo certbot --nginx -d david.sakoo.ru

# Автоматическое обновление
sudo certbot renew --dry-run
```

После настройки SSL обновите `FRONTEND_URL` в `backend/.env`:

```env
FRONTEND_URL=https://david.sakoo.ru
```

И перезапустите backend.

## Проверка работы

1. **Проверьте доступность домена:**
   ```bash
   curl -I http://david.sakoo.ru
   ```

2. **Проверьте логи Nginx:**
   ```bash
   sudo tail -f /var/log/nginx/david-warehouse-access.log
   sudo tail -f /var/log/nginx/david-warehouse-error.log
   ```

3. **Проверьте статус Nginx:**
   ```bash
   sudo systemctl status nginx
   ```

4. **Откройте в браузере:**
   - http://david.sakoo.ru (или https://david.sakoo.ru если настроен SSL)

## Устранение проблем

### Проблема: "502 Bad Gateway"

**Причина:** Backend не запущен или недоступен на порту 5000

**Решение:**
```bash
# Проверьте, запущен ли backend
pm2 list
# или
sudo systemctl status invoice-manager

# Запустите backend, если не запущен
pm2 start dist/index.js --name invoice-backend
# или
sudo systemctl start invoice-manager
```

### Проблема: "404 Not Found"

**Причина:** Frontend не собран или неправильный путь

**Решение:**
```bash
# Проверьте наличие директории dist
ls -la /var/www/david-warehouse/frontend/dist

# Если нет, соберите frontend
cd /var/www/david-warehouse/frontend
npm run build
```

### Проблема: "403 Forbidden"

**Причина:** Неправильные права доступа

**Решение:**
```bash
sudo chown -R www-data:www-data /var/www/david-warehouse
sudo chmod -R 755 /var/www/david-warehouse
```

### Проблема: Домен не открывается

**Причина:** DNS не настроен или не обновился

**Решение:**
1. Проверьте DNS запись:
   ```bash
   nslookup david.sakoo.ru
   ```

2. Убедитесь, что DNS указывает на правильный IP

3. Подождите несколько минут для распространения DNS (до 24 часов)

### Проблема: CORS ошибки

**Причина:** Неправильный FRONTEND_URL в backend/.env

**Решение:**
```bash
# Откройте .env файл
nano /var/www/david-warehouse/backend/.env

# Убедитесь, что указан правильный URL
FRONTEND_URL=http://david.sakoo.ru
# или
FRONTEND_URL=https://david.sakoo.ru

# Перезапустите backend
pm2 restart invoice-backend
```

## Автоматическая настройка

Используйте скрипт `deploy.sh` для автоматического обновления:

```bash
cd /var/www/david-warehouse
./deploy.sh
```

Скрипт автоматически:
- Обновит код с GitHub
- Соберёт frontend и backend
- Перезапустит приложение

## Структура файлов на сервере

```
/var/www/david-warehouse/
├── backend/
│   ├── dist/              # Собранный backend
│   ├── .env               # Переменные окружения
│   └── ...
├── frontend/
│   └── dist/              # Собранный frontend (обслуживается Nginx)
│       ├── index.html
│       ├── assets/
│       └── ...
└── ...
```

## Важные замечания

⚠️ **После каждого обновления frontend:**
1. Соберите frontend: `cd frontend && npm run build`
2. Убедитесь, что файлы в `/var/www/david-warehouse/frontend/dist` обновлены
3. Перезагрузите Nginx: `sudo systemctl reload nginx`

⚠️ **Безопасность:**
- Настройте SSL (HTTPS) для защиты данных
- Регулярно обновляйте зависимости
- Используйте сильный JWT_SECRET в `.env`

## Полезные команды

```bash
# Проверка конфигурации Nginx
sudo nginx -t

# Перезагрузка Nginx
sudo systemctl reload nginx

# Перезапуск Nginx
sudo systemctl restart nginx

# Просмотр логов в реальном времени
sudo tail -f /var/log/nginx/david-warehouse-error.log

# Проверка статуса backend
pm2 status
# или
sudo systemctl status invoice-manager
```

