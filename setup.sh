#!/bin/bash

set -e

echo "🚀 Начало установки Invoice Manager..."

# Цвета для вывода
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Проверка Node.js
echo "📋 Проверка Node.js..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js не установлен. Установите Node.js v18 или выше.${NC}"
    echo "   Скачайте с https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}❌ Требуется Node.js v18 или выше. Текущая версия: $(node --version)${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Node.js $(node --version) установлен${NC}"

# Проверка npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm не установлен${NC}"
    exit 1
fi

echo -e "${GREEN}✅ npm $(npm --version) установлен${NC}"

# Установка зависимостей backend
echo ""
echo "📦 Установка зависимостей backend..."
cd backend
if [ ! -d "node_modules" ]; then
    npm install
    echo -e "${GREEN}✅ Зависимости backend установлены${NC}"
else
    echo -e "${YELLOW}⚠️  node_modules уже существует, пропускаем установку${NC}"
fi

# Установка зависимостей frontend
echo ""
echo "📦 Установка зависимостей frontend..."
cd ../frontend
if [ ! -d "node_modules" ]; then
    npm install
    echo -e "${GREEN}✅ Зависимости frontend установлены${NC}"
else
    echo -e "${YELLOW}⚠️  node_modules уже существует, пропускаем установку${NC}"
fi

# Сборка backend
echo ""
echo "🔨 Сборка backend..."
cd ../backend
npm run build
echo -e "${GREEN}✅ Backend собран${NC}"

# Сборка frontend
echo ""
echo "🔨 Сборка frontend..."
cd ../frontend
npm run build
echo -e "${GREEN}✅ Frontend собран${NC}"

echo ""
echo -e "${GREEN}✅ Установка завершена успешно!${NC}"
echo ""
echo "📝 Следующие шаги:"
echo "   1. Создайте файл .env в директории backend:"
echo "      MONGO_URI=mongodb://gen_user:_*W%264xFfUJP9%2BO@147.45.175.217:27017/default_db?authSource=admin&directConnection=true"
echo "      JWT_SECRET=your-secret-key-change-in-production-min-32-chars"
echo "      PORT=5000"
echo "      FRONTEND_URL=https://david.sakoo.ru"
echo "      NODE_ENV=production"
echo ""
echo "   2. Запустите backend:"
echo "      cd backend && npm start"
echo ""
echo "   3. Настройте Nginx для обслуживания frontend (см. README.md)"

