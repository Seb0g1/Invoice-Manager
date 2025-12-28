#!/bin/bash

# Скрипт для резервного копирования MongoDB
# Использование: ./BACKUP_MONGODB.sh

set -e

BACKUP_DIR="/var/backups/mongodb"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="davidsklad"
BACKUP_FILE="$BACKUP_DIR/davidsklad_$DATE"

echo "💾 Создание резервной копии MongoDB..."

# Создание директории для бэкапов
mkdir -p "$BACKUP_DIR"

# Создание бэкапа
mongodump --db="$DB_NAME" --out="$BACKUP_FILE"

# Архивирование
tar -czf "$BACKUP_FILE.tar.gz" -C "$BACKUP_DIR" "davidsklad_$DATE"
rm -rf "$BACKUP_FILE"

# Удаление старых бэкапов (старше 7 дней)
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +7 -delete

echo "✅ Резервная копия создана: $BACKUP_FILE.tar.gz"

# Восстановление из бэкапа:
# tar -xzf davidsklad_YYYYMMDD_HHMMSS.tar.gz
# mongorestore --db=davidsklad davidsklad_YYYYMMDD_HHMMSS/davidsklad

