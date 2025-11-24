#!/bin/bash

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}🚀 Обновление проекта с GitHub${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Определение пути к проекту (можно изменить)
PROJECT_DIR="${PROJECT_DIR:-/var/www/david-warehouse}"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

# Проверка, что мы в правильной директории или переход в неё
if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${RED}❌ Директория проекта не найдена: $PROJECT_DIR${NC}"
    echo "   Установите переменную PROJECT_DIR или перейдите в директорию проекта"
    exit 1
fi

cd "$PROJECT_DIR"

# Проверка Git
if ! command -v git &> /dev/null; then
    echo -e "${RED}❌ Git не установлен${NC}"
    exit 1
fi

# Проверка, что это Git репозиторий
if [ ! -d ".git" ]; then
    echo -e "${RED}❌ Это не Git репозиторий${NC}"
    exit 1
fi

echo -e "${YELLOW}📥 Получение обновлений с GitHub...${NC}"
git fetch origin

# Проверка изменений
LOCAL=$(git rev-parse @)
REMOTE=$(git rev-parse @{u})
BASE=$(git merge-base @ @{u})

if [ $LOCAL = $REMOTE ]; then
    echo -e "${GREEN}✅ Проект уже актуален, обновлений нет${NC}"
    exit 0
elif [ $LOCAL = $BASE ]; then
    echo -e "${YELLOW}📥 Найдены обновления, начинаю загрузку...${NC}"
elif [ $REMOTE = $BASE ]; then
    echo -e "${RED}❌ У вас есть локальные изменения, которых нет на GitHub${NC}"
    echo "   Сначала закоммитьте и запушьте изменения"
    exit 1
else
    echo -e "${RED}❌ Ветки разошлись, требуется ручное слияние${NC}"
    exit 1
fi

# Создание бэкапа (опционально)
echo ""
echo -e "${YELLOW}💾 Создание резервной копии...${NC}"
BACKUP_DIR="/tmp/david-warehouse-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
if [ -d "$BACKEND_DIR/dist" ]; then
    cp -r "$BACKEND_DIR/dist" "$BACKUP_DIR/backend-dist" 2>/dev/null || true
fi
if [ -d "$FRONTEND_DIR/dist" ]; then
    cp -r "$FRONTEND_DIR/dist" "$BACKUP_DIR/frontend-dist" 2>/dev/null || true
fi
echo -e "${GREEN}✅ Резервная копия создана: $BACKUP_DIR${NC}"

# Получение обновлений
echo ""
echo -e "${YELLOW}📥 Загрузка изменений с GitHub...${NC}"
git pull origin main

# Проверка Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js не установлен${NC}"
    exit 1
fi

# Установка зависимостей backend
echo ""
echo -e "${YELLOW}📦 Установка зависимостей backend...${NC}"
cd "$BACKEND_DIR"
npm install --production=false

# Сборка backend
echo ""
echo -e "${YELLOW}🔨 Сборка backend...${NC}"
npm run build
echo -e "${GREEN}✅ Backend собран${NC}"

# Установка зависимостей frontend
echo ""
echo -e "${YELLOW}📦 Установка зависимостей frontend...${NC}"
cd "$FRONTEND_DIR"
npm install --production=false

# Сборка frontend
echo ""
echo -e "${YELLOW}🔨 Сборка frontend...${NC}"
npm run build
echo -e "${GREEN}✅ Frontend собран${NC}"

# Настройка прав доступа для frontend
echo ""
echo -e "${YELLOW}🔐 Настройка прав доступа...${NC}"
if [ -d "$FRONTEND_DIR/dist" ]; then
    sudo chown -R www-data:www-data "$FRONTEND_DIR/dist" 2>/dev/null || true
    sudo chmod -R 755 "$FRONTEND_DIR/dist" 2>/dev/null || true
    echo -e "${GREEN}✅ Права доступа настроены${NC}"
fi

# Перезапуск приложения
echo ""
echo -e "${YELLOW}🔄 Перезапуск приложения...${NC}"

# Проверка PM2
if command -v pm2 &> /dev/null; then
    if pm2 list | grep -q "invoice-backend"; then
        echo -e "${BLUE}   Перезапуск через PM2...${NC}"
        pm2 restart invoice-backend
        echo -e "${GREEN}✅ Приложение перезапущено через PM2${NC}"
    else
        echo -e "${YELLOW}⚠️  PM2 процесс 'invoice-backend' не найден${NC}"
    fi
fi

# Проверка systemd
if systemctl is-active --quiet invoice-manager.service 2>/dev/null; then
    echo -e "${BLUE}   Перезапуск через systemd...${NC}"
    sudo systemctl restart invoice-manager
    echo -e "${GREEN}✅ Приложение перезапущено через systemd${NC}"
fi

# Перезагрузка Nginx (если нужно)
if command -v nginx &> /dev/null; then
    echo ""
    echo -e "${YELLOW}🔄 Проверка конфигурации Nginx...${NC}"
    if sudo nginx -t 2>/dev/null; then
        sudo systemctl reload nginx
        echo -e "${GREEN}✅ Nginx перезагружен${NC}"
    else
        echo -e "${RED}⚠️  Ошибка в конфигурации Nginx, пропускаю перезагрузку${NC}"
    fi
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Обновление завершено успешно!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}📝 Информация:${NC}"
echo "   Резервная копия: $BACKUP_DIR"
echo "   Проект: $PROJECT_DIR"
echo ""
echo -e "${YELLOW}💡 Совет: Проверьте работу приложения${NC}"
echo "   - Backend логи: pm2 logs invoice-backend"
echo "   - Или: sudo journalctl -u invoice-manager -f"
echo "   - Nginx логи: sudo tail -f /var/log/nginx/david-warehouse-error.log"


