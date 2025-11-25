# 🔧 Устранение ошибки 502 Bad Gateway

Ошибка **502 Bad Gateway** означает, что Nginx не может подключиться к backend на порту 5000.

## Быстрая диагностика

```bash
cd /var/www/david-warehouse
chmod +x check-backend.sh
./check-backend.sh
```

Скрипт проверит все возможные проблемы и даст рекомендации.

## Основные причины и решения

### 1. Backend не запущен

**Проверка:**
```bash
pm2 status
# или
sudo lsof -i :5000
```

**Решение:**
```bash
cd /var/www/david-warehouse
chmod +x setup-pm2.sh
./setup-pm2.sh
```

### 2. Backend запущен, но падает с ошибкой

**Проверка логов:**
```bash
pm2 logs invoice-backend
```

**Типичные проблемы:**

#### a) Ошибка подключения к MongoDB
```
❌ Ошибка подключения к MongoDB
```

**Решение:**
- Проверьте `MONGO_URI` в `backend/.env`
- Убедитесь, что MongoDB доступен
- Проверьте сетевые настройки

#### b) Порт уже занят
```
Error: listen EADDRINUSE: address already in use :::5000
```

**Решение:**
```bash
# Найдите процесс, занимающий порт
sudo lsof -i :5000
# или
sudo netstat -tulpn | grep 5000

# Остановите процесс или измените PORT в .env
```

#### c) Ошибки в коде
Проверьте логи на наличие ошибок TypeScript/JavaScript.

**Решение:**
```bash
cd /var/www/david-warehouse/backend
npm run build
pm2 restart invoice-backend
```

### 3. Неправильный FRONTEND_URL

**Проверка:**
```bash
cd /var/www/david-warehouse/backend
cat .env | grep FRONTEND_URL
```

**Должно быть:**
```env
FRONTEND_URL=http://david.sakoo.ru
```

**Решение:**
```bash
nano backend/.env
# Измените FRONTEND_URL
pm2 restart invoice-backend
```

### 4. Проблемы с Nginx

**Проверка конфигурации:**
```bash
sudo nginx -t
```

**Проверка логов:**
```bash
sudo tail -f /var/log/nginx/david-warehouse-error.log
```

**Типичные ошибки:**

#### a) "upstream connection refused"
Backend не запущен или не слушает на порту 5000.

**Решение:** Запустите backend через PM2.

#### b) "upstream timeout"
Backend слишком долго отвечает.

**Решение:** Увеличьте таймауты в конфигурации Nginx или проверьте производительность backend.

### 5. Проблемы с правами доступа

**Проверка:**
```bash
ls -la /var/www/david-warehouse/backend/dist/index.js
```

**Решение:**
```bash
sudo chown -R $USER:$USER /var/www/david-warehouse
sudo chmod +x /var/www/david-warehouse/backend/dist/index.js
```

## Пошаговое решение

### Шаг 1: Проверьте статус backend

```bash
pm2 status
```

Если процесса нет:
```bash
cd /var/www/david-warehouse
./setup-pm2.sh
```

### Шаг 2: Проверьте логи

```bash
pm2 logs invoice-backend --lines 50
```

Ищите ошибки:
- MongoDB connection errors
- Port already in use
- Module not found
- Syntax errors

### Шаг 3: Проверьте .env

```bash
cd /var/www/david-warehouse/backend
cat .env
```

Убедитесь, что:
- `MONGO_URI` правильный
- `FRONTEND_URL=http://david.sakoo.ru`
- `PORT=5000`
- `JWT_SECRET` установлен

### Шаг 4: Пересоберите backend

```bash
cd /var/www/david-warehouse/backend
npm run build
pm2 restart invoice-backend
```

### Шаг 5: Проверьте порт

```bash
sudo lsof -i :5000
```

Должен быть процесс Node.js, слушающий на порту 5000.

### Шаг 6: Проверьте Nginx

```bash
sudo nginx -t
sudo systemctl status nginx
sudo tail -f /var/log/nginx/david-warehouse-error.log
```

### Шаг 7: Перезапустите всё

```bash
pm2 restart invoice-backend
sudo systemctl reload nginx
```

## Автоматическое исправление

Если backend не запущен, используйте скрипт:

```bash
cd /var/www/david-warehouse
chmod +x setup-pm2.sh
./setup-pm2.sh
```

## Проверка после исправления

1. **Проверьте статус:**
   ```bash
   pm2 status
   ```

2. **Проверьте порт:**
   ```bash
   curl http://localhost:5000/api/auth/me
   ```
   
   Должен вернуть 401 (не 502).

3. **Проверьте через домен:**
   ```bash
   curl http://david.sakoo.ru/api/auth/me
   ```
   
   Должен вернуть 401 (не 502).

4. **Откройте в браузере:**
   - http://david.sakoo.ru
   - Не должно быть ошибок 502 в консоли

## Частые ошибки в логах

### "Cannot find module"
```bash
cd /var/www/david-warehouse/backend
npm install
npm run build
pm2 restart invoice-backend
```

### "EADDRINUSE"
Порт занят. Найдите и остановите процесс:
```bash
sudo lsof -i :5000
sudo kill -9 <PID>
pm2 restart invoice-backend
```

### "MongoServerError: Authentication failed"
Проверьте `MONGO_URI` в `.env`.

### "ECONNREFUSED"
MongoDB недоступен. Проверьте подключение к MongoDB.

## Если ничего не помогает

1. **Полная переустановка:**
   ```bash
   cd /var/www/david-warehouse/backend
   pm2 delete invoice-backend
   rm -rf node_modules dist
   npm install
   npm run build
   ./setup-pm2.sh
   ```

2. **Проверьте системные логи:**
   ```bash
   sudo journalctl -u nginx -f
   sudo dmesg | tail
   ```

3. **Проверьте firewall:**
   ```bash
   sudo ufw status
   sudo iptables -L
   ```

## Полезные команды

```bash
# Статус PM2
pm2 status

# Логи backend
pm2 logs invoice-backend

# Перезапуск
pm2 restart invoice-backend

# Статус Nginx
sudo systemctl status nginx

# Логи Nginx
sudo tail -f /var/log/nginx/david-warehouse-error.log

# Проверка порта
sudo lsof -i :5000

# Тест подключения
curl http://localhost:5000/api/auth/me
```


