#!/bin/bash

# Скрипт для автоматического исправления проблем сборки
# Использование: ./fix-build.sh

set -e

echo "🔧 Автоматическое исправление проблем сборки..."
echo ""

PROJECT_DIR="/var/www/davidsklad"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

# Цвета
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Проверка директорий
if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${RED}❌ Директория проекта не найдена: $PROJECT_DIR${NC}"
    exit 1
fi

cd "$PROJECT_DIR"

# 1. Очистка и переустановка зависимостей Backend
echo -e "${BLUE}1. Очистка и переустановка зависимостей Backend...${NC}"
cd "$BACKEND_DIR"
echo -e "${YELLOW}   Удаление node_modules и package-lock.json...${NC}"
rm -rf node_modules package-lock.json 2>/dev/null || true
echo -e "${YELLOW}   Очистка npm кэша...${NC}"
npm cache clean --force 2>/dev/null || true
echo -e "${YELLOW}   Установка зависимостей...${NC}"
npm install
echo -e "${GREEN}✅ Зависимости Backend установлены${NC}"
echo ""

# 2. Сборка Backend
echo -e "${BLUE}2. Сборка Backend...${NC}"
if npm run build 2>&1 | tee /tmp/backend-build-fix.log; then
    echo -e "${GREEN}✅ Backend собран успешно${NC}"
else
    echo -e "${RED}❌ Ошибка при сборке Backend${NC}"
    echo -e "${YELLOW}Последние 30 строк лога:${NC}"
    tail -n 30 /tmp/backend-build-fix.log
    echo ""
    echo -e "${YELLOW}Полный лог: /tmp/backend-build-fix.log${NC}"
    exit 1
fi
echo ""

# 3. Очистка и переустановка зависимостей Frontend
echo -e "${BLUE}3. Очистка и переустановка зависимостей Frontend...${NC}"
cd "$FRONTEND_DIR"
echo -e "${YELLOW}   Удаление node_modules и package-lock.json...${NC}"
rm -rf node_modules package-lock.json 2>/dev/null || true
echo -e "${YELLOW}   Очистка npm кэша...${NC}"
npm cache clean --force 2>/dev/null || true
echo -e "${YELLOW}   Установка зависимостей...${NC}"
npm install
echo -e "${GREEN}✅ Зависимости Frontend установлены${NC}"
echo ""

# 4. Сборка Frontend
echo -e "${BLUE}4. Сборка Frontend...${NC}"
if npm run build 2>&1 | tee /tmp/frontend-build-fix.log; then
    echo -e "${GREEN}✅ Frontend собран успешно${NC}"
else
    echo -e "${RED}❌ Ошибка при сборке Frontend${NC}"
    echo -e "${YELLOW}Последние 30 строк лога:${NC}"
    tail -n 30 /tmp/frontend-build-fix.log
    echo ""
    echo -e "${YELLOW}Полный лог: /tmp/frontend-build-fix.log${NC}"
    exit 1
fi
echo ""

echo -e "${GREEN}✅ Все проблемы исправлены! Проект успешно собран.${NC}"
echo -e "${BLUE}📝 Логи сохранены:${NC}"
echo -e "   Backend:  /tmp/backend-build-fix.log"
echo -e "   Frontend: /tmp/frontend-build-fix.log"

