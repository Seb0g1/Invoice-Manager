#!/bin/bash

# Скрипт для диагностики проблем сборки проекта
# Использование: ./check-build-errors.sh

set -e

echo "🔍 Диагностика проблем сборки проекта..."
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
echo -e "${BLUE}1. Проверка директорий...${NC}"
if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${RED}❌ Директория проекта не найдена: $PROJECT_DIR${NC}"
    exit 1
fi
if [ ! -d "$BACKEND_DIR" ]; then
    echo -e "${RED}❌ Директория backend не найдена: $BACKEND_DIR${NC}"
    exit 1
fi
if [ ! -d "$FRONTEND_DIR" ]; then
    echo -e "${RED}❌ Директория frontend не найдена: $FRONTEND_DIR${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Директории найдены${NC}"
echo ""

# Проверка Node.js и npm
echo -e "${BLUE}2. Проверка Node.js и npm...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js не установлен${NC}"
    exit 1
fi
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm не установлен${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Node.js версия: $(node -v)${NC}"
echo -e "${GREEN}✅ npm версия: $(npm -v)${NC}"
echo ""

# Проверка зависимостей Backend
echo -e "${BLUE}3. Проверка зависимостей Backend...${NC}"
cd "$BACKEND_DIR"
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠️  node_modules не найдены. Устанавливаю зависимости...${NC}"
    npm install
else
    echo -e "${GREEN}✅ node_modules найдены${NC}"
    echo -e "${YELLOW}   Проверяю наличие TypeScript...${NC}"
    if [ ! -f "node_modules/typescript/bin/tsc" ]; then
        echo -e "${YELLOW}⚠️  TypeScript не найден. Устанавливаю devDependencies...${NC}"
        npm install
    else
        echo -e "${GREEN}✅ TypeScript найден${NC}"
    fi
fi
echo ""

# Проверка TypeScript конфигурации Backend
echo -e "${BLUE}4. Проверка TypeScript конфигурации Backend...${NC}"
if [ ! -f "tsconfig.json" ]; then
    echo -e "${RED}❌ tsconfig.json не найден${NC}"
    exit 1
fi
echo -e "${GREEN}✅ tsconfig.json найден${NC}"

# Попытка сборки Backend с выводом ошибок
echo -e "${BLUE}5. Попытка сборки Backend...${NC}"
if npm run build 2>&1 | tee /tmp/backend-build.log; then
    echo -e "${GREEN}✅ Backend собран успешно${NC}"
else
    echo -e "${RED}❌ Ошибка при сборке Backend${NC}"
    echo -e "${YELLOW}Последние 50 строк лога:${NC}"
    tail -n 50 /tmp/backend-build.log
    echo ""
    echo -e "${YELLOW}Полный лог сохранен в: /tmp/backend-build.log${NC}"
    exit 1
fi
echo ""

# Проверка зависимостей Frontend
echo -e "${BLUE}6. Проверка зависимостей Frontend...${NC}"
cd "$FRONTEND_DIR"
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠️  node_modules не найдены. Устанавливаю зависимости...${NC}"
    npm install
else
    echo -e "${GREEN}✅ node_modules найдены${NC}"
fi
echo ""

# Проверка TypeScript конфигурации Frontend
echo -e "${BLUE}7. Проверка TypeScript конфигурации Frontend...${NC}"
if [ ! -f "tsconfig.json" ]; then
    echo -e "${RED}❌ tsconfig.json не найден${NC}"
    exit 1
fi
echo -e "${GREEN}✅ tsconfig.json найден${NC}"

# Попытка сборки Frontend с выводом ошибок
echo -e "${BLUE}8. Попытка сборки Frontend...${NC}"
if npm run build 2>&1 | tee /tmp/frontend-build.log; then
    echo -e "${GREEN}✅ Frontend собран успешно${NC}"
else
    echo -e "${RED}❌ Ошибка при сборке Frontend${NC}"
    echo -e "${YELLOW}Последние 50 строк лога:${NC}"
    tail -n 50 /tmp/frontend-build.log
    echo ""
    echo -e "${YELLOW}Полный лог сохранен в: /tmp/frontend-build.log${NC}"
    exit 1
fi
echo ""

echo -e "${GREEN}✅ Все проверки пройдены успешно!${NC}"
echo -e "${BLUE}📝 Если были ошибки, проверьте логи:${NC}"
echo -e "   Backend:  /tmp/backend-build.log"
echo -e "   Frontend: /tmp/frontend-build.log"

