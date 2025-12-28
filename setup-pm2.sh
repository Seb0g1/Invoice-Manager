#!/bin/bash

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}🚀 Настройка PM2 для постоянного запуска${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Определение пути к проекту
PROJECT_DIR="${PROJECT_DIR:-/var/www/david-warehouse}"
BACKEND_DIR="$PROJECT_DIR/backend"

# Проверка, что директория существует
if [ ! -d "$BACKEND_DIR" ]; then
    echo -e "${RED}❌ Директория backend не найдена: $BACKEND_DIR${NC}"
    exit 1
fi

cd "$BACKEND_DIR"

# Проверка Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js не установлен${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Node.js $(node --version) найден${NC}"

# Проверка PM2
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}📦 Установка PM2...${NC}"
    sudo npm install -g pm2
    echo -e "${GREEN}✅ PM2 установлен${NC}"
else
    echo -e "${GREEN}✅ PM2 уже установлен${NC}"
fi
echo ""

# Проверка .env файла
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  Файл .env не найден${NC}"
    echo ""
    echo -e "${BLUE}Создайте файл .env с настройками:${NC}"
    echo "MONGO_URI=mongodb://gen_user:_*W%264xFfUJP9%2BO@147.45.175.217:27017/default_db?authSource=admin&directConnection=true"
    echo "JWT_SECRET=your-secret-key-change-in-production-min-32-chars"
    echo "PORT=5000"
    echo "FRONTEND_URL=http://david.sakoo.ru"
    echo "NODE_ENV=production"
    echo ""
    read -p "Продолжить без .env? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo -e "${GREEN}✅ Файл .env найден${NC}"
    
    # Проверка FRONTEND_URL
    if grep -q "FRONTEND_URL=http://david.sakoo.ru" .env || grep -q "FRONTEND_URL=https://david.sakoo.ru" .env; then
        echo -e "${GREEN}✅ FRONTEND_URL настроен правильно${NC}"
    else
        echo -e "${YELLOW}⚠️  FRONTEND_URL не настроен или указан неправильно${NC}"
        echo "   Убедитесь, что в .env указано: FRONTEND_URL=http://david.sakoo.ru"
    fi
fi
echo ""

# Проверка сборки
if [ ! -d "dist" ] || [ ! -f "dist/index.js" ]; then
    echo -e "${YELLOW}⚠️  Backend не собран. Запускаю сборку...${NC}"
    npm run build
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Ошибка при сборке backend${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Backend собран${NC}"
else
    echo -e "${GREEN}✅ Backend уже собран${NC}"
fi
echo ""

# Остановка существующего процесса (если есть)
if pm2 list | grep -q "invoice-backend"; then
    echo -e "${YELLOW}🛑 Остановка существующего процесса...${NC}"
    pm2 delete invoice-backend 2>/dev/null || true
    echo -e "${GREEN}✅ Процесс остановлен${NC}"
fi

# Запуск через PM2
echo -e "${YELLOW}🚀 Запуск backend через PM2...${NC}"
pm2 start dist/index.js --name invoice-backend

# Настройка автозапуска
echo ""
echo -e "${YELLOW}⚙️  Настройка автозапуска...${NC}"

# Проверка, настроен ли автозапуск
if pm2 startup | grep -q "already"; then
    echo -e "${GREEN}✅ Автозапуск уже настроен${NC}"
else
    echo -e "${YELLOW}Настройка автозапуска PM2...${NC}"
    echo -e "${BLUE}Выполните команду, которую покажет PM2 (обычно с sudo)${NC}"
    pm2 startup
    echo ""
    echo -e "${YELLOW}После выполнения команды нажмите Enter...${NC}"
    read
fi

# Сохранение конфигурации
pm2 save
echo -e "${GREEN}✅ Конфигурация сохранена${NC}"

# Показ статуса
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ Backend настроен и запущен!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
pm2 status
echo ""
echo -e "${BLUE}📝 Полезные команды:${NC}"
echo "   pm2 status              - Статус процессов"
echo "   pm2 logs invoice-backend - Просмотр логов"
echo "   pm2 restart invoice-backend - Перезапуск"
echo "   pm2 stop invoice-backend - Остановка"
echo "   pm2 monit - Мониторинг в реальном времени"
echo ""
echo -e "${GREEN}✅ Backend будет автоматически запускаться при перезагрузке сервера${NC}"

