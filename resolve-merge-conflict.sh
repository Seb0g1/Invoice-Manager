#!/bin/bash

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}🔧 Разрешение конфликта слияния${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

PROJECT_DIR="${PROJECT_DIR:-/var/www/david-warehouse}"
cd "$PROJECT_DIR"

# Проверка статуса
echo -e "${YELLOW}📋 Проверка статуса Git...${NC}"
git status

# Отмена текущего слияния
echo -e "${YELLOW}🔄 Отмена текущего слияния...${NC}"
git merge --abort 2>/dev/null || echo "Нет активного слияния для отмены"

# Очистка stash
echo -e "${YELLOW}🗑️  Очистка stash...${NC}"
git stash clear 2>/dev/null || true

# Сброс локальных изменений в package-lock.json (можно пересоздать)
echo -e "${YELLOW}🔄 Сброс изменений в package-lock.json...${NC}"
git checkout --theirs backend/package-lock.json 2>/dev/null || true
git checkout --ours backend/package-lock.json 2>/dev/null || true
git reset HEAD backend/package-lock.json 2>/dev/null || true
git checkout HEAD -- backend/package-lock.json 2>/dev/null || true

# Очистка рабочей директории
echo -e "${YELLOW}🧹 Очистка рабочей директории...${NC}"
git reset --hard HEAD 2>/dev/null || true
git clean -fd 2>/dev/null || true

# Получение обновлений
echo -e "${YELLOW}📥 Получение обновлений с GitHub...${NC}"
git fetch origin

# Обновление ветки
echo -e "${YELLOW}🔄 Обновление ветки main...${NC}"
git reset --hard origin/main

echo -e "${GREEN}✅ Конфликт разрешен, проект обновлен${NC}"
echo ""
echo -e "${BLUE}Следующие шаги:${NC}"
echo "1. Пересоздайте package-lock.json: cd backend && npm install"
echo "2. Соберите проект: npm run build"
echo "3. Перезапустите PM2: pm2 restart all"

