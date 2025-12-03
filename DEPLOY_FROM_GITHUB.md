# 🚀 Деплой проекта с GitHub на сервер davidsklad.ru

## 📋 Предварительные требования

- Сервер с Ubuntu/Debian
- Домен `davidsklad.ru` настроен и указывает на IP сервера
- MongoDB установлена и запущена
- Доступ по SSH к серверу
- Права sudo
- Git установлен на сервере
- Проект загружен на GitHub

## 🔧 Шаг 1: Подготовка сервера

### 1.1 Обновление системы
```bash
sudo apt update
sudo apt upgrade -y
```

### 1.2 Установка Git (если не установлен)
```bash
sudo apt install -y git
```

### 1.3 Установка Node.js (версия 18 или выше)
```bash
# Установка Node.js через NodeSource
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Проверка версии
node --version
npm --version
```

### 1.4 Установка PM2 (менеджер процессов)
```bash
sudo npm install -g pm2
```

### 1.5 Установка Nginx
```bash
sudo apt install -y nginx
```

### 1.6 Установка Certbot (для SSL)
```bash
sudo apt install -y certbot python3-certbot-nginx
```

## 📥 Шаг 2: Клонирование проекта с GitHub

### 2.1 Создание директории проекта
```bash
sudo mkdir -p /var/www/davidsklad
sudo chown -R $USER:$USER /var/www/davidsklad
cd /var/www/davidsklad
```

### 2.2 Клонирование репозитория

**Вариант 1: Публичный репозиторий (HTTPS)**
```bash
git clone https://github.com/YOUR_USERNAME/david-warehouse.git .
```

**Вариант 2: Приватный репозиторий (SSH)**
```bash
# Сначала настройте SSH ключи на сервере
ssh-keygen -t ed25519 -C "your_email@example.com"
# Скопируйте публичный ключ в GitHub Settings → SSH and GPG keys
cat ~/.ssh/id_ed25519.pub

# Затем клонируйте
git clone git@github.com:YOUR_USERNAME/david-warehouse.git .
```

**Вариант 3: С токеном доступа (для приватных репозиториев)**
```bash
# Создайте Personal Access Token на GitHub
# Settings → Developer settings → Personal access tokens → Generate new token
# Права: repo (полный доступ к репозиториям)

git clone https://YOUR_TOKEN@github.com/YOUR_USERNAME/david-warehouse.git .
```

### 2.3 Проверка клонирования
```bash
ls -la
# Должны быть видны папки: backend, frontend, и другие файлы проекта
```

## 🔐 Шаг 3: Настройка переменных окружения

### 3.1 Backend (.env)
```bash
cd /var/www/davidsklad/backend
nano .env
```

Содержимое `.env`:
```env
# Порт сервера
PORT=5000

# MongoDB (уже установлена на сервере)
MONGO_URI=mongodb://localhost:27017/davidsklad

# JWT секрет (сгенерируйте случайную строку)
JWT_SECRET=ваш-очень-длинный-случайный-секрет-ключ-минимум-32-символа

# Frontend URL
FRONTEND_URL=https://davidsklad.ru

# Backend URL
BACKEND_URL=https://davidsklad.ru

# Telegram Bot (если используется)
TELEGRAM_BOT_TOKEN=ваш-токен-бота
TELEGRAM_CHAT_ID=ваш-chat-id

# OZON API (если используется)
# Настраивается через интерфейс приложения

# Yandex Market API (если используется)
# Настраивается через интерфейс приложения
```

**Генерация JWT_SECRET:**
```bash
openssl rand -base64 32
```

### 3.2 Frontend (.env.production)
```bash
cd /var/www/davidsklad/frontend
nano .env.production
```

Содержимое `.env.production`:
```env
VITE_API_URL=https://davidsklad.ru/api
```

## 🏗️ Шаг 4: Сборка проекта

### 4.1 Установка зависимостей Backend
```bash
cd /var/www/davidsklad/backend
npm install
```

### 4.2 Сборка Backend
```bash
npm run build
```

### 4.3 Установка зависимостей Frontend
```bash
cd /var/www/davidsklad/frontend
npm install
```

### 4.4 Сборка Frontend
```bash
npm run build
```

## ⚙️ Шаг 5: Настройка MongoDB

### 5.1 Проверка подключения
```bash
# Проверка статуса MongoDB
sudo systemctl status mongod

# Если не запущена, запустите
sudo systemctl start mongod
sudo systemctl enable mongod
```

### 5.2 Создание базы данных (опционально)
```bash
mongosh
use davidsklad
exit
```

## 🚀 Шаг 6: Настройка PM2 для Backend

### 6.1 Проверка конфигурации PM2
```bash
cd /var/www/davidsklad/backend
cat ecosystem.config.js
```

### 6.2 Создание директории для логов
```bash
mkdir -p /var/www/davidsklad/backend/logs
```

### 6.3 Запуск приложения через PM2
```bash
cd /var/www/davidsklad/backend
pm2 start ecosystem.config.js
pm2 save
pm2 startup
# Выполните команду, которую выведет pm2 startup
```

## 🌐 Шаг 7: Настройка Nginx

### 7.1 Создание конфигурации Nginx
```bash
sudo nano /etc/nginx/sites-available/davidsklad
```

Содержимое конфигурации:
```nginx
# Редирект с HTTP на HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name davidsklad.ru www.davidsklad.ru;
    
    return 301 https://$server_name$request_uri;
}

# Основной сервер (HTTPS)
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name davidsklad.ru www.davidsklad.ru;

    # SSL сертификаты (будут установлены через Certbot)
    ssl_certificate /etc/letsencrypt/live/davidsklad.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/davidsklad.ru/privkey.pem;
    
    # SSL настройки
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

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
        expires 1d;
        add_header Cache-Control "public, must-revalidate";
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

### 7.2 Активация конфигурации
```bash
sudo ln -s /etc/nginx/sites-available/davidsklad /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 🔒 Шаг 8: Установка SSL сертификата

### 8.1 Получение сертификата Let's Encrypt
```bash
sudo certbot --nginx -d davidsklad.ru -d www.davidsklad.ru
```

Следуйте инструкциям:
- Введите email для уведомлений
- Согласитесь с условиями
- Выберите редирект с HTTP на HTTPS (опция 2)

### 8.2 Автоматическое обновление сертификата
```bash
# Проверка автоматического обновления
sudo certbot renew --dry-run
```

## 🔥 Шаг 9: Настройка Firewall

### 9.1 Настройка UFW
```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

## 📊 Шаг 10: Проверка работы

### 10.1 Проверка PM2
```bash
pm2 status
pm2 logs davidsklad-backend
```

### 10.2 Проверка Nginx
```bash
sudo systemctl status nginx
```

### 10.3 Проверка MongoDB
```bash
sudo systemctl status mongod
```

### 10.4 Проверка в браузере
Откройте в браузере: `https://davidsklad.ru`

## 🔄 Шаг 11: Обновление проекта с GitHub

### 11.1 Ручное обновление
```bash
cd /var/www/davidsklad

# Получение последних изменений
git pull origin main

# Установка зависимостей Backend
cd backend
npm install
npm run build

# Установка зависимостей Frontend
cd ../frontend
npm install
npm run build

# Перезапуск приложения
cd ../backend
pm2 restart davidsklad-backend

# Перезагрузка Nginx
sudo systemctl reload nginx
```

### 11.2 Автоматическое обновление (через скрипт)

Используйте готовый скрипт `deploy.sh`:
```bash
cd /var/www/davidsklad
chmod +x deploy.sh
./deploy.sh
```

### 11.3 Автоматическое обновление через cron (опционально)

Создайте скрипт для автоматического обновления:
```bash
nano /var/www/davidsklad/auto-update.sh
```

Содержимое:
```bash
#!/bin/bash
cd /var/www/davidsklad
git pull origin main
cd backend && npm install --production && npm run build
cd ../frontend && npm install --production && npm run build
cd ../backend && pm2 restart davidsklad-backend
```

Сделайте исполняемым:
```bash
chmod +x /var/www/davidsklad/auto-update.sh
```

Добавьте в crontab (обновление каждый день в 3:00):
```bash
crontab -e
# Добавьте строку:
0 3 * * * /var/www/davidsklad/auto-update.sh >> /var/log/davidsklad-update.log 2>&1
```

## 📝 Шаг 12: Мониторинг и логи

### 12.1 Просмотр логов PM2
```bash
pm2 logs davidsklad-backend
pm2 logs davidsklad-backend --lines 100
```

### 12.2 Просмотр логов Nginx
```bash
sudo tail -f /var/log/nginx/davidsklad-access.log
sudo tail -f /var/log/nginx/davidsklad-error.log
```

### 12.3 Мониторинг PM2
```bash
pm2 monit
```

## 🛠️ Полезные команды

### Перезапуск приложения
```bash
pm2 restart davidsklad-backend
```

### Перезапуск Nginx
```bash
sudo systemctl restart nginx
```

### Перезапуск MongoDB
```bash
sudo systemctl restart mongod
```

### Проверка портов
```bash
sudo netstat -tulpn | grep :5000
sudo netstat -tulpn | grep :80
sudo netstat -tulpn | grep :443
```

### Просмотр статуса всех сервисов
```bash
pm2 status
sudo systemctl status nginx
sudo systemctl status mongod
```

## ⚠️ Важные замечания

1. **Безопасность:**
   - Убедитесь, что `.env` файлы не доступны через веб-сервер
   - Используйте сильные пароли для MongoDB
   - Регулярно обновляйте систему и зависимости
   - Не коммитьте `.env` файлы в Git

2. **Резервное копирование:**
   - Настройте автоматическое резервное копирование MongoDB
   - Регулярно делайте бэкапы базы данных
   - Используйте скрипт `BACKUP_MONGODB.sh`

3. **Мониторинг:**
   - Настройте мониторинг сервера (CPU, RAM, Disk)
   - Настройте алерты при падении приложения
   - Используйте PM2 для автоматического перезапуска

4. **Производительность:**
   - Настройте кэширование в Nginx
   - Оптимизируйте MongoDB индексы
   - Используйте CDN для статических файлов (опционально)

## 📋 Чек-лист деплоя

- [ ] Git установлен
- [ ] Node.js установлен
- [ ] PM2 установлен и настроен
- [ ] Nginx установлен и настроен
- [ ] SSL сертификат установлен
- [ ] MongoDB запущена и доступна
- [ ] Проект клонирован с GitHub
- [ ] Переменные окружения настроены
- [ ] Проект собран (backend и frontend)
- [ ] PM2 запущен и приложение работает
- [ ] Nginx настроен и работает
- [ ] Firewall настроен
- [ ] Домен работает (HTTPS)
- [ ] Логи проверены
- [ ] Резервное копирование настроено

## 🔄 Быстрое обновление (краткая версия)

```bash
cd /var/www/davidsklad
git pull origin main
cd backend && npm install --production && npm run build
cd ../frontend && npm install --production && npm run build
cd ../backend && pm2 restart davidsklad-backend
sudo systemctl reload nginx
```

---

**Дата создания:** 2025-01-27  
**Домен:** davidsklad.ru  
**Репозиторий:** https://github.com/YOUR_USERNAME/david-warehouse

