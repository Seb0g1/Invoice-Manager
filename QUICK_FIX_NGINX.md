# ⚡ Быстрое исправление дефолтной страницы nginx

## Проблема
Все еще показывается "Welcome to nginx!" вместо приложения.

## 🔧 Пошаговое решение

### Шаг 1: Проверка текущего состояния

```bash
# Проверка активных конфигураций
ls -la /etc/nginx/sites-enabled/

# Проверка существования dist
ls -la /var/www/davidsklad/frontend/dist/
```

### Шаг 2: Удаление дефолтной конфигурации

```bash
# Удаление дефолтной конфигурации (если есть)
sudo rm -f /etc/nginx/sites-enabled/default
```

### Шаг 3: Создание правильной конфигурации

```bash
sudo nano /etc/nginx/sites-available/davidsklad
```

**ВАЖНО:** Удалите все содержимое и вставьте ТОЛЬКО это:

```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name davidsklad.ru www.davidsklad.ru _;

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
```

**Ключевое отличие:** добавлен `default_server` и `_` в `server_name` - это сделает эту конфигурацию приоритетной.

Сохраните (Ctrl+O, Enter, Ctrl+X).

### Шаг 4: Активация и проверка

```bash
# Активация конфигурации
sudo ln -sf /etc/nginx/sites-available/davidsklad /etc/nginx/sites-enabled/davidsklad

# Проверка синтаксиса
sudo nginx -t

# Если ошибок нет, перезагрузите
sudo systemctl reload nginx
```

### Шаг 5: Проверка фронтенда

```bash
# Проверка существования dist
ls -la /var/www/davidsklad/frontend/dist/index.html

# Если файла нет, соберите фронтенд
cd /var/www/davidsklad/frontend
npm run build
```

### Шаг 6: Проверка прав доступа

```bash
sudo chown -R www-data:www-data /var/www/davidsklad/frontend/dist
sudo chmod -R 755 /var/www/davidsklad/frontend/dist
```

### Шаг 7: Полная перезагрузка nginx

```bash
sudo systemctl restart nginx
```

## ✅ Проверка

```bash
# Проверка активных конфигураций
sudo nginx -T | grep "server_name"

# Должно показать davidsklad.ru

# Проверка логов
sudo tail -20 /var/log/nginx/error.log
```

## 🚀 Все одной командой

```bash
sudo rm -f /etc/nginx/sites-enabled/default && \
sudo tee /etc/nginx/sites-available/davidsklad > /dev/null << 'EOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name davidsklad.ru www.davidsklad.ru _;
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
sudo ln -sf /etc/nginx/sites-available/davidsklad /etc/nginx/sites-enabled/davidsklad && \
cd /var/www/davidsklad/frontend && npm run build && \
sudo chown -R www-data:www-data /var/www/davidsklad/frontend/dist && \
sudo nginx -t && \
sudo systemctl restart nginx
```

---

**После выполнения:** Откройте http://davidsklad.ru/ - должно работать! ✅

