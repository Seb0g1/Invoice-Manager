#!/bin/bash

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🚀 Запуск Invoice Manager..."

# Проверка .env файла
if [ ! -f "backend/.env" ]; then
    echo -e "${RED}❌ Файл backend/.env не найден!${NC}"
    echo "   Создайте файл .env в директории backend с настройками MongoDB"
    exit 1
fi

# Проверка сборки
if [ ! -d "backend/dist" ]; then
    echo -e "${YELLOW}⚠️  Backend не собран. Запускаю сборку...${NC}"
    cd backend
    npm run build
    cd ..
fi

if [ ! -d "frontend/dist" ]; then
    echo -e "${YELLOW}⚠️  Frontend не собран. Запускаю сборку...${NC}"
    cd frontend
    npm run build
    cd ..
fi

# Запуск backend
echo ""
echo "🔵 Запуск backend..."
cd backend
npm start

