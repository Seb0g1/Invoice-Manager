# 🗄️ Установка MongoDB на том же сервере

## ✅ Да, это возможно и часто практикуется!

Размещение MongoDB на том же сервере, где работает ваш сайт, имеет смысл для:
- ✅ Небольших и средних проектов
- ✅ Снижения затрат (один сервер вместо двух)
- ✅ Упрощения управления
- ✅ Уменьшения задержек (локальное подключение)

## 📋 Требования к серверу

### Минимальные требования:
- **RAM:** минимум 2GB (рекомендуется 4GB+)
- **Диск:** минимум 10GB свободного места (рекомендуется 20GB+)
- **CPU:** 2+ ядра

### Рекомендации:
- **RAM:** 4-8GB для комфортной работы
- **SSD диск** для лучшей производительности
- **Регулярные бэкапы** базы данных

## 🚀 Установка MongoDB на Ubuntu Server

### Шаг 1: Установка MongoDB

```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Импорт публичного ключа MongoDB
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor

# Добавление репозитория MongoDB
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Обновление списка пакетов
sudo apt update

# Установка MongoDB
sudo apt install -y mongodb-org

# Проверка версии
mongod --version
```

### Шаг 2: Запуск и автозапуск MongoDB

```bash
# Запуск MongoDB
sudo systemctl start mongod

# Включение автозапуска при загрузке системы
sudo systemctl enable mongod

# Проверка статуса
sudo systemctl status mongod
```

### Шаг 3: Настройка безопасности MongoDB

#### Вариант 1: Локальное подключение без аутентификации (для разработки)

Если MongoDB будет использоваться только локально (на том же сервере), можно оставить без пароля:

```bash
# MongoDB уже настроен для локального подключения
# Просто используйте: mongodb://localhost:27017/invoice-db
```

#### Вариант 2: С аутентификацией (рекомендуется для продакшена)

```bash
# Подключение к MongoDB
mongosh

# Создание администратора
use admin
db.createUser({
  user: "admin",
  pwd: "ваш-сильный-пароль-здесь",
  roles: [ { role: "userAdminAnyDatabase", db: "admin" } ]
})

# Создание пользователя для приложения
use invoice-db
db.createUser({
  user: "invoice_user",
  pwd: "ваш-пароль-для-приложения",
  roles: [ { role: "readWrite", db: "invoice-db" } ]
})

# Выход
exit
```

### Шаг 4: Включение аутентификации в MongoDB

```bash
# Редактирование конфигурации MongoDB
sudo nano /etc/mongod.conf
```

Найдите и раскомментируйте/добавьте:

```yaml
security:
  authorization: enabled
```

Перезапустите MongoDB:

```bash
sudo systemctl restart mongod
```

### Шаг 5: Настройка firewall (если используется)

```bash
# MongoDB использует порт 27017
# Если firewall активен, разрешите локальные подключения (они уже разрешены по умолчанию)
# Для внешних подключений (НЕ рекомендуется для безопасности):
# sudo ufw allow 27017/tcp
```

**⚠️ ВАЖНО:** Не открывайте порт 27017 для внешнего доступа без необходимости! MongoDB должен быть доступен только локально.

## 🔧 Настройка приложения

### Обновление .env файла

Откройте `backend/.env` и обновите `MONGO_URI`:

#### Без аутентификации (локально):
```env
MONGO_URI=mongodb://localhost:27017/invoice-db
```

#### С аутентификацией:
```env
MONGO_URI=mongodb://invoice_user:ваш-пароль-для-приложения@localhost:27017/invoice-db?authSource=invoice-db
```

### Перезапуск приложения

```bash
# Если используете PM2
pm2 restart invoice-backend

# Если используете systemd
sudo systemctl restart invoice-manager
```

## 📊 Мониторинг MongoDB

### Проверка статуса

```bash
# Статус службы
sudo systemctl status mongod

# Подключение к MongoDB
mongosh
# или с аутентификацией
mongosh -u invoice_user -p ваш-пароль --authenticationDatabase invoice-db
```

### Полезные команды в MongoDB

```javascript
// Показать все базы данных
show dbs

// Использовать базу данных
use invoice-db

// Показать коллекции
show collections

// Подсчет документов в коллекции
db.users.countDocuments()
db.suppliers.countDocuments()
db.invoices.countDocuments()

// Статистика базы данных
db.stats()
```

## 💾 Резервное копирование

### Создание скрипта бэкапа

```bash
# Создание директории для бэкапов
sudo mkdir -p /backup/mongodb
sudo chown $USER:$USER /backup/mongodb

# Создание скрипта
nano ~/backup-mongodb.sh
```

Вставьте следующий скрипт:

```bash
#!/bin/bash

# Настройки
BACKUP_DIR="/backup/mongodb"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="invoice-db"
RETENTION_DAYS=7

# Создание бэкапа
# Без аутентификации:
mongodump --db=$DB_NAME --out="$BACKUP_DIR/$DATE"

# С аутентификацией (раскомментируйте и настройте):
# mongodump --uri="mongodb://invoice_user:пароль@localhost:27017/$DB_NAME?authSource=$DB_NAME" --out="$BACKUP_DIR/$DATE"

# Сжатие бэкапа
cd "$BACKUP_DIR"
tar -czf "$DATE.tar.gz" "$DATE"
rm -rf "$DATE"

# Удаление старых бэкапов (старше 7 дней)
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete

echo "Бэкап создан: $BACKUP_DIR/$DATE.tar.gz"
```

Сделайте скрипт исполняемым:

```bash
chmod +x ~/backup-mongodb.sh
```

### Настройка автоматического бэкапа

```bash
# Редактирование crontab
crontab -e

# Добавьте строку для ежедневного бэкапа в 2:00 ночи:
0 2 * * * /home/ваш-пользователь/backup-mongodb.sh >> /var/log/mongodb-backup.log 2>&1
```

### Восстановление из бэкапа

```bash
# Распаковка бэкапа
cd /backup/mongodb
tar -xzf 20240127_020000.tar.gz

# Восстановление
# Без аутентификации:
mongorestore --db=invoice-db /backup/mongodb/20240127_020000/invoice-db

# С аутентификацией:
mongorestore --uri="mongodb://invoice_user:пароль@localhost:27017/invoice-db?authSource=invoice-db" /backup/mongodb/20240127_020000/invoice-db
```

## 🔒 Безопасность

### Рекомендации:

1. **Используйте аутентификацию** в продакшене
2. **Не открывайте порт 27017** для внешнего доступа
3. **Регулярно обновляйте MongoDB:**
   ```bash
   sudo apt update && sudo apt upgrade mongodb-org
   ```
4. **Настройте firewall:**
   ```bash
   sudo ufw status
   # Убедитесь, что порт 27017 закрыт для внешнего доступа
   ```
5. **Используйте сильные пароли**
6. **Регулярно делайте бэкапы**

## 📈 Оптимизация производительности

### Настройка конфигурации MongoDB

```bash
sudo nano /etc/mongod.conf
```

Рекомендуемые настройки для сервера с 4GB RAM:

```yaml
storage:
  wiredTiger:
    engineConfig:
      cacheSizeGB: 1  # 25% от RAM (для 4GB сервера)

systemLog:
  verbosity: 1
  destination: file
  path: /var/log/mongodb/mongod.log
  logAppend: true

net:
  port: 27017
  bindIp: 127.0.0.1  # Только локальные подключения
```

Перезапустите после изменений:

```bash
sudo systemctl restart mongod
```

## 🆚 Сравнение: Локальный vs Облачный MongoDB

### Локальный MongoDB (на том же сервере)
✅ **Преимущества:**
- Нет дополнительных затрат
- Низкая задержка (локальное подключение)
- Простое управление
- Полный контроль

❌ **Недостатки:**
- Нет автоматического масштабирования
- Нужно самостоятельно делать бэкапы
- Ограничения ресурсов сервера
- Нет репликации из коробки

### Облачный MongoDB (MongoDB Atlas, etc.)
✅ **Преимущества:**
- Автоматические бэкапы
- Масштабируемость
- Репликация и высокая доступность
- Управляемый сервис

❌ **Недостатки:**
- Дополнительные затраты
- Задержка сети
- Меньше контроля

## 🎯 Рекомендация

Для вашего проекта (складское управление) **локальный MongoDB на том же сервере** — хороший выбор, если:
- У вас до 10-50 пользователей
- Объем данных не превышает 10-50GB
- Сервер имеет минимум 4GB RAM
- Вы настроите регулярные бэкапы

## 📝 Быстрая установка (одной командой)

```bash
# Полная установка и настройка MongoDB
curl -fsSL https://raw.githubusercontent.com/mongodb/mongo/master/docs/install/ubuntu.sh | bash
sudo apt install -y mongodb-org
sudo systemctl start mongod
sudo systemctl enable mongod
```

## ✅ Проверка установки

```bash
# Проверка статуса
sudo systemctl status mongod

# Проверка подключения
mongosh --eval "db.version()"

# Проверка из приложения
# В логах backend должно быть: "✅ Подключено к MongoDB"
```

## 🆘 Устранение проблем

### MongoDB не запускается

```bash
# Проверка логов
sudo tail -f /var/log/mongodb/mongod.log

# Проверка конфигурации
sudo mongod --config /etc/mongod.conf --fork

# Проверка порта
sudo netstat -tlnp | grep 27017
```

### Недостаточно места на диске

```bash
# Проверка свободного места
df -h

# Очистка старых логов
sudo journalctl --vacuum-time=7d
```

### Проблемы с правами доступа

```bash
# Проверка прав
ls -la /var/lib/mongodb

# Исправление прав
sudo chown -R mongodb:mongodb /var/lib/mongodb
sudo chown -R mongodb:mongodb /var/log/mongodb
```

---

**Готово!** Теперь MongoDB работает на том же сервере, что и ваше приложение. 🎉

