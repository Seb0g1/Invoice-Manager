# 🚀 Быстрая настройка домена david.sakoo.ru

## Шаги на сервере

### 1. Соберите frontend

```bash
cd /var/www/david-warehouse/frontend
npm install
npm run build
```

### 2. Настройте Nginx

```bash
# Скопируйте конфигурацию
cd /var/www/david-warehouse
sudo cp nginx-david.sakoo.ru.conf /etc/nginx/sites-available/david-warehouse

# Активируйте
sudo ln -s /etc/nginx/sites-available/david-warehouse /etc/nginx/sites-enabled/

# Проверьте конфигурацию
sudo nginx -t

# Перезагрузите Nginx
sudo systemctl reload nginx
```

### 3. Настройте Backend

Откройте `backend/.env` и убедитесь, что указан правильный URL:

```env
FRONTEND_URL=http://david.sakoo.ru
```

Перезапустите backend:

```bash
pm2 restart invoice-backend
# или
sudo systemctl restart invoice-manager
```

### 4. Проверьте права доступа

```bash
sudo chown -R www-data:www-data /var/www/david-warehouse/frontend/dist
sudo chmod -R 755 /var/www/david-warehouse/frontend/dist
```

### 5. Проверьте DNS

Убедитесь, что DNS запись `david.sakoo.ru` указывает на IP вашего сервера:

```bash
nslookup david.sakoo.ru
```

## Готово! 

Откройте в браузере: **http://david.sakoo.ru**

## Если что-то не работает

См. подробную инструкцию в `NGINX_SETUP.md`

