#!/bin/bash

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}🚀 Запуск Frontend (Vite Dev Server)${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Проверка Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js не установлен!${NC}"
    echo "   Установите Node.js с https://nodejs.org/"
    exit 1
fi

echo -e "${GREEN}✅ Node.js $(node --version) найден${NC}"
echo ""

# Переход в директорию frontend
cd "$(dirname "$0")/frontend" || exit 1

if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Файл package.json не найден!${NC}"
    echo "   Убедитесь, что вы находитесь в корне проекта"
    exit 1
fi

# Проверка node_modules
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Установка зависимостей...${NC}"
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Не удалось установить зависимости${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Зависимости установлены${NC}"
else
    echo -e "${GREEN}✅ Зависимости уже установлены${NC}"
fi
echo ""

# Запуск dev сервера
echo -e "${YELLOW}🚀 Запуск Vite dev server...${NC}"
echo ""
echo -e "${BLUE}Frontend будет доступен по адресу: http://localhost:3000${NC}"
echo ""
echo -e "${YELLOW}Для остановки нажмите Ctrl+C${NC}"
echo ""

npm run dev

