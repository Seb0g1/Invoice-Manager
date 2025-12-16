# ⚡ Быстрое исправление ошибки подключения к MongoDB

## Проблема
```
MongooseServerSelectionError: connect ECONNREFUSED ::1:27017
```

## 🚀 Быстрое решение (3 команды)

```bash
# 1. Запустить MongoDB
sudo systemctl start mongod

# 2. Изменить .env файл (использовать 127.0.0.1 вместо localhost)
cd /var/www/davidsklad/backend
sed -i 's|mongodb://localhost:27017|mongodb://127.0.0.1:27017|g' .env

# 3. Перезапустить приложение
pm2 restart davidsklad-backend
```

## ✅ Проверка

```bash
# Проверить статус MongoDB
sudo systemctl status mongod

# Проверить логи приложения
pm2 logs davidsklad-backend --lines 20
```

Должно быть: `✅ Подключено к MongoDB`

---

**Подробная инструкция:** см. `FIX_MONGODB_CONNECTION.md`

