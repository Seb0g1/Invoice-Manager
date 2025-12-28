# 🚀 Быстрая инструкция по деплою на davidsklad.ru

## 📋 Быстрый старт

### 1. На сервере выполните:
```bash
# Скачайте скрипт настройки
wget https://raw.githubusercontent.com/your-repo/david-warehouse/main/setup-server.sh
chmod +x setup-server.sh
sudo ./setup-server.sh
```

### 2. Загрузите проект на сервер:
```bash
# Через Git
cd /var/www
sudo git clone <ваш-repo-url> davidsklad
sudo chown -R $USER:$USER davidsklad

# Или через SCP (с локального компьютера)
scp -r david-warehouse/* user@davidsklad.ru:/var/www/davidsklad/
```

### 3. Настройте переменные окружения:
```bash
cd /var/www/davidsklad/backend
nano .env
# Скопируйте содержимое из DEPLOY_PRODUCTION.md

cd /var/www/davidsklad/frontend
nano .env.production
# VITE_API_URL=https://davidsklad.ru/api
```

### 4. Запустите деплой:
```bash
cd /var/www/davidsklad
chmod +x deploy.sh
./deploy.sh
```

### 5. Настройте Nginx:
```bash
sudo nano /etc/nginx/sites-available/davidsklad
# Скопируйте конфигурацию из DEPLOY_PRODUCTION.md

sudo ln -s /etc/nginx/sites-available/davidsklad /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 6. Установите SSL:
```bash
sudo certbot --nginx -d davidsklad.ru -d www.davidsklad.ru
```

## ✅ Готово!

Откройте в браузере: `https://davidsklad.ru`

## 📝 Полезные команды

```bash
# Просмотр логов
pm2 logs davidsklad-backend

# Перезапуск
pm2 restart davidsklad-backend

# Статус
pm2 status

# Обновление проекта
cd /var/www/davidsklad
./deploy.sh
```

## 🔄 Резервное копирование MongoDB

```bash
# Ручной бэкап
./BACKUP_MONGODB.sh

# Автоматический бэкап (добавьте в crontab)
0 2 * * * /var/www/davidsklad/BACKUP_MONGODB.sh
```

---

**Подробная инструкция:** См. `DEPLOY_PRODUCTION.md`

