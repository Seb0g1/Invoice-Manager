#!/bin/bash

# Скрипт для автоматического деплоя проекта davidsklad.ru
# Использование: ./deploy.sh [--pull] [--skip-build]
#   --pull      - обновить код с GitHub перед деплоем
#   --skip-build - пропустить сборку (только перезапуск)

set -e

echo "🚀 Начало деплоя проекта davidsklad.ru..."

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Проверка, что скрипт запущен от правильного пользователя
if [ "$EUID" -eq 0 ]; then 
   echo -e "${RED}❌ Не запускайте скрипт от root пользователя${NC}"
   exit 1
fi

PROJECT_DIR="/var/www/davidsklad"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

# Парсинг аргументов
PULL_FROM_GITHUB=false
SKIP_BUILD=false

for arg in "$@"; do
  case $arg in
    --pull)
      PULL_FROM_GITHUB=true
      shift
      ;;
    --skip-build)
      SKIP_BUILD=true
      shift
      ;;
    *)
      shift
      ;;
  esac
done

# Проверка существования директорий
if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${YELLOW}⚠️  Директория проекта не найдена. Создаю...${NC}"
    sudo mkdir -p "$PROJECT_DIR"
    sudo chown -R $USER:$USER "$PROJECT_DIR"
fi

cd "$PROJECT_DIR"

# 1. Обновление зависимостей Backend
echo -e "${GREEN}📦 Установка зависимостей Backend...${NC}"
cd "$BACKEND_DIR"
npm install

# 2. Сборка Backend
if [ "$SKIP_BUILD" = false ]; then
    echo -e "${GREEN}🏗️  Сборка Backend...${NC}"
    npm run build
else
    echo -e "${YELLOW}⏭️  Пропуск сборки Backend (--skip-build)${NC}"
fi

# 3. Обновление зависимостей Frontend
if [ "$SKIP_BUILD" = false ]; then
    echo -e "${GREEN}📦 Установка зависимостей Frontend...${NC}"
    cd "$FRONTEND_DIR"
    npm install

    # 4. Сборка Frontend
    echo -e "${GREEN}🏗️  Сборка Frontend...${NC}"
    npm run build
else
    echo -e "${YELLOW}⏭️  Пропуск сборки Frontend (--skip-build)${NC}"
fi

# 5. Создание директории для uploads (если не существует)
echo -e "${GREEN}📁 Создание директории для uploads...${NC}"
mkdir -p "$BACKEND_DIR/uploads"
mkdir -p "$BACKEND_DIR/logs"

# 6. Перезапуск приложения через PM2
echo -e "${GREEN}🔄 Перезапуск приложения...${NC}"
cd "$BACKEND_DIR"
if pm2 list | grep -q "davidsklad-backend"; then
    pm2 restart davidsklad-backend
else
    pm2 start ecosystem.config.js
    pm2 save
fi

# 7. Перезагрузка Nginx
echo -e "${GREEN}🌐 Перезагрузка Nginx...${NC}"
sudo systemctl reload nginx

# 8. Проверка статуса
echo -e "${GREEN}✅ Проверка статуса...${NC}"
pm2 status
sudo systemctl status nginx --no-pager -l

echo -e "${GREEN}✅ Деплой завершен успешно!${NC}"
echo -e "${YELLOW}📝 Проверьте логи: pm2 logs davidsklad-backend${NC}"
