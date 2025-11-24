# 🚀 Инструкция по развёртыванию на Ubuntu Server

## Предварительные требования

1. **Ubuntu Server** 20.04 или выше
2. **Node.js** v18+ (установите через nvm или с официального сайта)
3. **Nginx** (для обслуживания frontend)
4. **PM2** (для управления процессом backend, опционально)

## Шаг 1: Установка зависимостей системы

```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Установка Node.js через nvm (рекомендуется)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 18
nvm use 18

# Или установка Node.js напрямую
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Установка Nginx
sudo apt install nginx -y

# Установка PM2 (глобально)
sudo npm install -g pm2
```

## Шаг 2: Клонирование и настройка проекта

```bash
# Создание директории для проекта (если не существует)
sudo mkdir -p /var/www/david-warehouse
sudo chown $USER:$USER /var/www/david-warehouse

# Клонирование репозитория
cd /var/www
git clone https://github.com/Seb0g1/Invoice-Manager.git david-warehouse
cd david-warehouse

# Запуск скрипта установки
chmod +x setup.sh
./setup.sh
```

**Альтернативно:** Если проект уже находится в другом месте, скопируйте собранные файлы:

```bash
# После сборки проекта
sudo mkdir -p /var/www/david-warehouse
sudo cp -r frontend/dist /var/www/david-warehouse/frontend/
sudo cp -r backend /var/www/david-warehouse/
sudo chown -R www-data:www-data /var/www/david-warehouse
```

## Шаг 3: Настройка переменных окружения

```bash
# Создание .env файла
cd backend
nano .env
```

Вставьте следующее содержимое (замените JWT_SECRET на случайную строку):

```env
MONGO_URI=mongodb://gen_user:_*W%264xFfUJP9%2BO@147.45.175.217:27017/default_db?authSource=admin&directConnection=true
JWT_SECRET=ваш-секретный-ключ-минимум-32-символа-измените-это
PORT=5000
FRONTEND_URL=https://david.sakoo.ru
NODE_ENV=production
```

Сохраните файл (Ctrl+O, Enter, Ctrl+X).

## Шаг 4: Настройка Nginx для поддомена david.sakoo.ru

```bash
# Копирование конфигурации из проекта
sudo cp nginx-david.sakoo.ru.conf /etc/nginx/sites-available/david-warehouse

# Или создание конфигурации вручную
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

**Важно:** Убедитесь, что путь `/var/www/david-warehouse` существует и содержит собранный frontend. Если проект находится в другом месте, измените путь в конфигурации.

Активируйте конфигурацию:

```bash
sudo ln -s /etc/nginx/sites-available/david-warehouse /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

**Примечание:** Если у вас уже есть другие сайты на сервере, убедитесь, что они не конфликтуют с этой конфигурацией. Каждый поддомен должен иметь свой отдельный файл конфигурации в `/etc/nginx/sites-available/`.

## Шаг 5: Запуск приложения

### Вариант 1: С PM2 (рекомендуется)

```bash
cd /path/to/Invoice-Manager/backend
pm2 start dist/index.js --name invoice-backend
pm2 startup
pm2 save
```

### Вариант 2: С systemd

Создайте файл сервиса:

```bash
sudo nano /etc/systemd/system/invoice-manager.service
```

Вставьте:

```ini
[Unit]
Description=Invoice Manager Backend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/david-warehouse/backend
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Активируйте и запустите:

```bash
sudo systemctl daemon-reload
sudo systemctl enable invoice-manager
sudo systemctl start invoice-manager
sudo systemctl status invoice-manager
```

## Шаг 6: Настройка SSL (опционально, но рекомендуется)

```bash
# Установка Certbot
sudo apt install certbot python3-certbot-nginx -y

# Получение SSL сертификата
sudo certbot --nginx -d david.sakoo.ru

# Автоматическое обновление
sudo certbot renew --dry-run
```

## Проверка работы

1. Откройте браузер и перейдите на `https://david.sakoo.ru`
2. Проверьте логи backend: `pm2 logs invoice-backend` или `sudo journalctl -u invoice-manager -f`
3. Проверьте логи Nginx: `sudo tail -f /var/log/nginx/error.log`

## Обновление приложения

```bash
cd /var/www/david-warehouse
git pull origin main
cd backend && npm install && npm run build
cd ../frontend && npm install && npm run build

# Копирование собранного frontend в рабочую директорию (если нужно)
# sudo cp -r frontend/dist /var/www/david-warehouse/frontend/

pm2 restart invoice-backend
# или
sudo systemctl restart invoice-manager
```

## Резервное копирование

Рекомендуется настроить автоматическое резервное копирование MongoDB:

```bash
# Создание скрипта бэкапа
nano ~/backup-mongodb.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/backup/mongodb"
DATE=$(date +%Y%m%d_%H%M%S)
mongodump --uri="mongodb://gen_user:_*W%264xFfUJP9%2BO@147.45.175.217:27017/default_db?authSource=admin" --out="$BACKUP_DIR/$DATE"
# Удаление бэкапов старше 7 дней
find $BACKUP_DIR -type d -mtime +7 -exec rm -rf {} \;
```

```bash
chmod +x ~/backup-mongodb.sh
# Добавьте в crontab для ежедневного бэкапа
crontab -e
# Добавьте строку: 0 2 * * * /home/username/backup-mongodb.sh
```

