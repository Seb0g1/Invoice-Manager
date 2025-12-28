# 🌐 Исправление проблемы с фронтендом на davidsklad.ru

## Проблема

Показывается дефолтная страница nginx "Welcome to nginx!" вместо вашего приложения.

## 🔍 Диагностика

### Шаг 1: Проверка существующих конфигураций

```bash
# Проверка активных конфигураций
ls -la /etc/nginx/sites-enabled/

# Проверка доступных конфигураций
ls -la /etc/nginx/sites-available/
```

### Шаг 2: Проверка собранного фронтенда

```bash
# Проверка существования директории dist
ls -la /var/www/davidsklad/frontend/dist/

# Проверка наличия index.html
ls -la /var/www/davidsklad/frontend/dist/index.html
```

Если директории `dist` нет или она пустая, нужно собрать фронтенд:

```bash
cd /var/www/davidsklad/frontend
npm install
npm run build
```

## 🔧 Решение

### Вариант 1: Создание конфигурации для HTTP (без SSL)

Если SSL еще не настроен:

```bash
# 1. Создание конфигурации
sudo nano /etc/nginx/sites-available/davidsklad
```

Вставьте следующее содержимое:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name davidsklad.ru www.davidsklad.ru;

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
# 2. Активация конфигурации
sudo ln -s /etc/nginx/sites-available/davidsklad /etc/nginx/sites-enabled/

# 3. Удаление дефолтной конфигурации (если мешает)
sudo rm -f /etc/nginx/sites-enabled/default

# 4. Проверка конфигурации
sudo nginx -t

# 5. Перезагрузка nginx
sudo systemctl reload nginx
```

### Вариант 2: Проверка и исправление существующей конфигурации

```bash
# 1. Проверка существующей конфигурации
sudo cat /etc/nginx/sites-available/davidsklad

# 2. Если конфигурация существует, проверьте:
#    - Правильный ли путь к dist: /var/www/davidsklad/frontend/dist
#    - Правильный ли server_name: davidsklad.ru

# 3. Если нужно исправить
sudo nano /etc/nginx/sites-available/davidsklad
```

## ✅ Проверка

### Шаг 1: Проверка собранного фронтенда

```bash
# Убедитесь, что фронтенд собран
cd /var/www/davidsklad/frontend
ls -la dist/

# Если dist пустая или не существует, соберите:
npm run build
```

### Шаг 2: Проверка прав доступа

```bash
# Убедитесь, что nginx может читать файлы
sudo chown -R www-data:www-data /var/www/davidsklad/frontend/dist
sudo chmod -R 755 /var/www/davidsklad/frontend/dist
```

### Шаг 3: Проверка конфигурации nginx

```bash
# Проверка синтаксиса
sudo nginx -t

# Проверка активных конфигураций
sudo nginx -T | grep server_name
```

### Шаг 4: Проверка логов

```bash
# Логи доступа
sudo tail -f /var/log/nginx/davidsklad-access.log

# Логи ошибок
sudo tail -f /var/log/nginx/davidsklad-error.log
```

## 🚀 Быстрое решение (одной командой)

```bash
# Создание конфигурации, сборка фронтенда и перезагрузка nginx
cd /var/www/davidsklad && \
sudo tee /etc/nginx/sites-available/davidsklad > /dev/null << 'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name davidsklad.ru www.davidsklad.ru;
    client_max_body_size 20M;
    access_log /var/log/nginx/davidsklad-access.log;
    error_log /var/log/nginx/davidsklad-error.log;
    location /uploads {
        alias /var/www/davidsklad/backend/uploads;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
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
    location / {
        root /var/www/davidsklad/frontend/dist;
        try_files $uri $uri/ /index.html;
        index index.html;
    }
    location = /index.html {
        root /var/www/davidsklad/frontend/dist;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
}
EOF
sudo ln -sf /etc/nginx/sites-available/davidsklad /etc/nginx/sites-enabled/ && \
sudo rm -f /etc/nginx/sites-enabled/default && \
cd frontend && npm run build && \
sudo chown -R www-data:www-data /var/www/davidsklad/frontend/dist && \
sudo nginx -t && \
sudo systemctl reload nginx
```

## 🔒 Настройка SSL (после исправления HTTP)

После того как сайт заработает на HTTP, настройте SSL:

```bash
sudo certbot --nginx -d davidsklad.ru -d www.davidsklad.ru
```

## 🆘 Если ничего не помогает

1. **Проверьте, что backend работает:**
   ```bash
   pm2 status
   curl http://localhost:5000/api/health
   ```

2. **Проверьте DNS:**
   ```bash
   nslookup davidsklad.ru
   ```

3. **Проверьте файрвол:**
   ```bash
   sudo ufw status
   sudo ufw allow 'Nginx Full'
   ```

4. **Перезапустите nginx:**
   ```bash
   sudo systemctl restart nginx
   ```

---

**После выполнения:** Сайт должен работать на http://davidsklad.ru/ ✅

