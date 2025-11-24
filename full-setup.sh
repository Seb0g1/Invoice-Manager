#!/bin/bash

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}🚀 Полная установка и настройка проекта${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Определение пути к проекту
PROJECT_DIR="${PROJECT_DIR:-/var/www/david-warehouse}"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

# Проверка, что мы в правильной директории
if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${RED}❌ Директория проекта не найдена: $PROJECT_DIR${NC}"
    echo "   Создайте директорию или установите PROJECT_DIR"
    exit 1
fi

cd "$PROJECT_DIR"

# ============================================
# ШАГ 1: Проверка и установка зависимостей системы
# ============================================
echo -e "${BLUE}[1/8] Проверка системных зависимостей...${NC}"

# Node.js
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}⚠️  Node.js не установлен. Установите Node.js v18+${NC}"
    echo "   sudo apt install nodejs npm"
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}❌ Требуется Node.js v18 или выше. Текущая версия: $(node --version)${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Node.js $(node --version) установлен${NC}"

# Git
if ! command -v git &> /dev/null; then
    echo -e "${YELLOW}⚠️  Git не установлен. Устанавливаю...${NC}"
    sudo apt install git -y
fi
echo -e "${GREEN}✅ Git установлен${NC}"

# PM2
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}⚠️  PM2 не установлен. Устанавливаю...${NC}"
    sudo npm install -g pm2
    echo -e "${GREEN}✅ PM2 установлен${NC}"
else
    echo -e "${GREEN}✅ PM2 уже установлен${NC}"
fi

# Nginx
if ! command -v nginx &> /dev/null; then
    echo -e "${YELLOW}⚠️  Nginx не установлен. Устанавливаю...${NC}"
    sudo apt update
    sudo apt install nginx -y
    echo -e "${GREEN}✅ Nginx установлен${NC}"
else
    echo -e "${GREEN}✅ Nginx уже установлен${NC}"
fi

echo ""

# ============================================
# ШАГ 2: Настройка Git репозитория
# ============================================
echo -e "${BLUE}[2/8] Настройка Git репозитория...${NC}"

if [ ! -d ".git" ]; then
    echo -e "${YELLOW}⚠️  Git репозиторий не инициализирован. Инициализирую...${NC}"
    git init
    git remote add origin https://github.com/Seb0g1/Invoice-Manager.git 2>/dev/null || true
    git branch -M main
    echo -e "${GREEN}✅ Git репозиторий инициализирован${NC}"
else
    echo -e "${GREEN}✅ Git репозиторий уже настроен${NC}"
    
    # Получение обновлений
    if git remote get-url origin >/dev/null 2>&1; then
        echo -e "${YELLOW}📥 Получение обновлений с GitHub...${NC}"
        git fetch origin
        git pull origin main || echo -e "${YELLOW}⚠️  Не удалось получить обновления (возможно, есть локальные изменения)${NC}"
    fi
fi

echo ""

# ============================================
# ШАГ 3: Установка зависимостей проекта
# ============================================
echo -e "${BLUE}[3/8] Установка зависимостей проекта...${NC}"

# Backend
echo -e "${YELLOW}📦 Установка зависимостей backend...${NC}"
cd "$BACKEND_DIR"
if [ ! -d "node_modules" ]; then
    npm install
    echo -e "${GREEN}✅ Зависимости backend установлены${NC}"
else
    echo -e "${YELLOW}⚠️  node_modules уже существует, обновляю...${NC}"
    npm install
fi

# Frontend
echo -e "${YELLOW}📦 Установка зависимостей frontend...${NC}"
cd "$FRONTEND_DIR"
if [ ! -d "node_modules" ]; then
    npm install
    echo -e "${GREEN}✅ Зависимости frontend установлены${NC}"
else
    echo -e "${YELLOW}⚠️  node_modules уже существует, обновляю...${NC}"
    npm install
fi

echo ""

# ============================================
# ШАГ 4: Настройка .env
# ============================================
echo -e "${BLUE}[4/8] Настройка переменных окружения...${NC}"

cd "$BACKEND_DIR"

if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  Файл .env не найден. Создаю...${NC}"
    cat > .env << EOF
MONGO_URI=mongodb://gen_user:_*W%264xFfUJP9%2BO@147.45.175.217:27017/default_db?authSource=admin&directConnection=true
JWT_SECRET=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
PORT=5000
FRONTEND_URL=http://david.sakoo.ru
NODE_ENV=production
EOF
    echo -e "${GREEN}✅ Файл .env создан${NC}"
    echo -e "${YELLOW}⚠️  ВАЖНО: Проверьте JWT_SECRET в файле .env${NC}"
else
    echo -e "${GREEN}✅ Файл .env уже существует${NC}"
    
    # Проверка FRONTEND_URL
    if ! grep -q "FRONTEND_URL=http://david.sakoo.ru" .env && ! grep -q "FRONTEND_URL=https://david.sakoo.ru" .env; then
        echo -e "${YELLOW}⚠️  FRONTEND_URL не настроен правильно${NC}"
        echo -e "${BLUE}   Отредактируйте .env и установите: FRONTEND_URL=http://david.sakoo.ru${NC}"
    fi
fi

echo ""

# ============================================
# ШАГ 5: Сборка проекта
# ============================================
echo -e "${BLUE}[5/8] Сборка проекта...${NC}"

# Backend
echo -e "${YELLOW}🔨 Сборка backend...${NC}"
cd "$BACKEND_DIR"
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Ошибка при сборке backend${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Backend собран${NC}"

# Frontend
echo -e "${YELLOW}🔨 Сборка frontend...${NC}"
cd "$FRONTEND_DIR"
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Ошибка при сборке frontend${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Frontend собран${NC}"

echo ""

# ============================================
# ШАГ 6: Настройка PM2
# ============================================
echo -e "${BLUE}[6/8] Настройка PM2...${NC}"

cd "$BACKEND_DIR"

# Остановка существующего процесса
if pm2 list | grep -q "invoice-backend"; then
    echo -e "${YELLOW}🛑 Остановка существующего процесса...${NC}"
    pm2 delete invoice-backend 2>/dev/null || true
fi

# Запуск через PM2
echo -e "${YELLOW}🚀 Запуск backend через PM2...${NC}"
pm2 start dist/index.js --name invoice-backend

# Настройка автозапуска
echo -e "${YELLOW}⚙️  Настройка автозапуска...${NC}"
if ! pm2 startup | grep -q "already"; then
    echo -e "${BLUE}Выполните команду, которую покажет PM2 (обычно с sudo)${NC}"
    pm2 startup
    echo ""
    echo -e "${YELLOW}После выполнения команды нажмите Enter...${NC}"
    read
fi

pm2 save
echo -e "${GREEN}✅ PM2 настроен${NC}"

echo ""

# ============================================
# ШАГ 7: Настройка Nginx
# ============================================
echo -e "${BLUE}[7/8] Настройка Nginx...${NC}"

cd "$PROJECT_DIR"

# Копирование конфигурации
if [ -f "nginx-david.sakoo.ru.conf" ]; then
    echo -e "${YELLOW}📋 Копирование конфигурации Nginx...${NC}"
    sudo cp nginx-david.sakoo.ru.conf /etc/nginx/sites-available/david-warehouse
    
    # Активация
    if [ ! -L "/etc/nginx/sites-enabled/david-warehouse" ]; then
        sudo ln -s /etc/nginx/sites-available/david-warehouse /etc/nginx/sites-enabled/
    fi
    
    # Проверка конфигурации
    if sudo nginx -t 2>/dev/null; then
        sudo systemctl reload nginx
        echo -e "${GREEN}✅ Nginx настроен и перезагружен${NC}"
    else
        echo -e "${RED}❌ Ошибка в конфигурации Nginx${NC}"
        sudo nginx -t
    fi
else
    echo -e "${YELLOW}⚠️  Файл nginx-david.sakoo.ru.conf не найден${NC}"
    echo -e "${BLUE}   Настройте Nginx вручную (см. NGINX_SETUP.md)${NC}"
fi

# Настройка прав доступа
echo -e "${YELLOW}🔐 Настройка прав доступа...${NC}"
sudo chown -R www-data:www-data "$FRONTEND_DIR/dist" 2>/dev/null || true
sudo chmod -R 755 "$FRONTEND_DIR/dist" 2>/dev/null || true
echo -e "${GREEN}✅ Права доступа настроены${NC}"

echo ""

# ============================================
# ШАГ 8: Финальная проверка
# ============================================
echo -e "${BLUE}[8/8] Финальная проверка...${NC}"

# Проверка PM2
if pm2 list | grep -q "invoice-backend"; then
    STATUS=$(pm2 jlist | grep -A 5 "invoice-backend" | grep "pm2_env.status" | cut -d'"' -f4)
    if [ "$STATUS" = "online" ]; then
        echo -e "${GREEN}✅ Backend запущен и работает${NC}"
    else
        echo -e "${RED}❌ Backend не запущен (статус: $STATUS)${NC}"
    fi
else
    echo -e "${RED}❌ Backend не найден в PM2${NC}"
fi

# Проверка порта
if command -v lsof &> /dev/null; then
    if sudo lsof -i :5000 >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Backend слушает на порту 5000${NC}"
    else
        echo -e "${RED}❌ Backend не слушает на порту 5000${NC}"
    fi
fi

# Проверка Nginx
if sudo systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✅ Nginx работает${NC}"
else
    echo -e "${RED}❌ Nginx не работает${NC}"
fi

echo ""

# ============================================
# РЕЗЮМЕ
# ============================================
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Установка завершена!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}📝 Информация:${NC}"
echo "   Проект: $PROJECT_DIR"
echo "   Backend: http://localhost:5000"
echo "   Frontend: http://david.sakoo.ru"
echo ""
echo -e "${BLUE}🔑 Учётные данные для входа:${NC}"
echo "   Директор: director / CGJ-Ge-90"
echo "   Сборщик: collector / 12345"
echo ""
echo -e "${BLUE}📋 Полезные команды:${NC}"
echo "   pm2 status              - Статус процессов"
echo "   pm2 logs invoice-backend - Логи backend"
echo "   pm2 restart invoice-backend - Перезапуск"
echo "   sudo systemctl status nginx - Статус Nginx"
echo ""
echo -e "${YELLOW}⚠️  ВАЖНО:${NC}"
echo "   1. Проверьте файл backend/.env"
echo "   2. Убедитесь, что FRONTEND_URL=http://david.sakoo.ru"
echo "   3. Проверьте, что DNS настроен правильно"
echo "   4. Откройте http://david.sakoo.ru в браузере"
echo ""

