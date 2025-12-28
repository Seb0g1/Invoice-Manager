# 🚀 Быстрый деплой с GitHub на сервер

## 📥 Клонирование проекта

```bash
# 1. Создайте директорию
sudo mkdir -p /var/www/davidsklad
sudo chown -R $USER:$USER /var/www/davidsklad
cd /var/www/davidsklad

# 2. Клонируйте репозиторий (замените YOUR_USERNAME)
git clone https://github.com/YOUR_USERNAME/david-warehouse.git .

# Или для приватного репозитория с SSH:
# git clone git@github.com:YOUR_USERNAME/david-warehouse.git .
```

## ⚙️ Настройка

```bash
# 1. Настройте Backend .env
cd backend
nano .env
# Укажите: MONGO_URI, JWT_SECRET, FRONTEND_URL, BACKEND_URL

# 2. Настройте Frontend .env.production
cd ../frontend
nano .env.production
# Укажите: VITE_API_URL=https://davidsklad.ru/api
```

## 🏗️ Сборка и запуск

```bash
# 1. Соберите Backend
cd /var/www/davidsklad/backend
npm install
npm run build

# 2. Соберите Frontend
cd ../frontend
npm install
npm run build

# 3. Запустите через PM2
cd ../backend
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## 🌐 Настройка Nginx

```bash
# 1. Создайте конфигурацию
sudo nano /etc/nginx/sites-available/davidsklad
# Скопируйте конфигурацию из DEPLOY_FROM_GITHUB.md

# 2. Активируйте
sudo ln -s /etc/nginx/sites-available/davidsklad /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 🔒 SSL сертификат

```bash
sudo certbot --nginx -d davidsklad.ru -d www.davidsklad.ru
```

## ✅ Готово!

Откройте: `https://davidsklad.ru`

## 🔄 Обновление проекта

```bash
cd /var/www/davidsklad
git pull origin main
cd backend && npm install --production && npm run build
cd ../frontend && npm install --production && npm run build
cd ../backend && pm2 restart davidsklad-backend
```

---

**Подробная инструкция:** `DEPLOY_FROM_GITHUB.md`

