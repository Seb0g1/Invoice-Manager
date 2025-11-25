#!/bin/bash

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}🔄 Обновление проекта с GitHub${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

PROJECT_DIR="${PROJECT_DIR:-/var/www/david-warehouse}"
cd "$PROJECT_DIR"

# Проверка Git репозитория
if [ ! -d ".git" ]; then
    echo -e "${RED}❌ Git репозиторий не найден${NC}"
    exit 1
fi

# Сохранение локальных изменений
echo -e "${YELLOW}💾 Сохранение локальных изменений...${NC}"
git stash push -m "Local changes before update $(date +%Y-%m-%d_%H-%M-%S)" || true

# Получение обновлений
echo -e "${YELLOW}📥 Получение обновлений с GitHub...${NC}"
git fetch origin

# Обновление ветки
echo -e "${YELLOW}🔄 Обновление ветки main...${NC}"
git pull origin main

# Применение сохраненных изменений (если есть)
if git stash list | grep -q "Local changes"; then
    echo -e "${YELLOW}📋 Попытка применить сохраненные изменения...${NC}"
    if git stash pop; then
        echo -e "${GREEN}✅ Локальные изменения применены${NC}"
    else
        echo -e "${YELLOW}⚠️  Есть конфликты в сохраненных изменениях. Проверьте: git stash list${NC}"
    fi
fi

echo -e "${GREEN}✅ Проект обновлен${NC}"
echo ""
echo -e "${BLUE}Следующие шаги:${NC}"
echo "1. Установите зависимости: cd backend && npm install && cd ../frontend && npm install"
echo "2. Соберите проект: cd backend && npm run build && cd ../frontend && npm run build"
echo "3. Перезапустите PM2: pm2 restart all"
