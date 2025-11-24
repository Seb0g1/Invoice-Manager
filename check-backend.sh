#!/bin/bash

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}🔍 Диагностика Backend${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

PROJECT_DIR="${PROJECT_DIR:-/var/www/david-warehouse}"
BACKEND_DIR="$PROJECT_DIR/backend"

# Проверка 1: Существует ли директория
echo -e "${YELLOW}[1/8] Проверка директории backend...${NC}"
if [ ! -d "$BACKEND_DIR" ]; then
    echo -e "${RED}❌ Директория не найдена: $BACKEND_DIR${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Директория найдена${NC}"
echo ""

# Проверка 2: Файл .env
echo -e "${YELLOW}[2/8] Проверка файла .env...${NC}"
cd "$BACKEND_DIR"
if [ ! -f ".env" ]; then
    echo -e "${RED}❌ Файл .env не найден!${NC}"
    echo -e "${YELLOW}   Создайте файл .env с настройками${NC}"
else
    echo -e "${GREEN}✅ Файл .env найден${NC}"
    if grep -q "FRONTEND_URL=http://david.sakoo.ru" .env || grep -q "FRONTEND_URL=https://david.sakoo.ru" .env; then
        echo -e "${GREEN}✅ FRONTEND_URL настроен правильно${NC}"
    else
        echo -e "${YELLOW}⚠️  FRONTEND_URL не настроен или указан неправильно${NC}"
        echo -e "${BLUE}   Текущее значение:${NC}"
        grep FRONTEND_URL .env || echo "   FRONTEND_URL не найден"
    fi
fi
echo ""

# Проверка 3: Сборка backend
echo -e "${YELLOW}[3/8] Проверка сборки backend...${NC}"
if [ ! -d "dist" ] || [ ! -f "dist/index.js" ]; then
    echo -e "${RED}❌ Backend не собран!${NC}"
    echo -e "${YELLOW}   Запускаю сборку...${NC}"
    npm run build
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Ошибка при сборке${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Backend собран${NC}"
else
    echo -e "${GREEN}✅ Backend собран${NC}"
fi
echo ""

# Проверка 4: PM2 статус
echo -e "${YELLOW}[4/8] Проверка PM2...${NC}"
if command -v pm2 &> /dev/null; then
    echo -e "${GREEN}✅ PM2 установлен${NC}"
    if pm2 list | grep -q "invoice-backend"; then
        echo -e "${GREEN}✅ Процесс invoice-backend найден в PM2${NC}"
        pm2 list | grep invoice-backend
    else
        echo -e "${RED}❌ Процесс invoice-backend не найден в PM2${NC}"
        echo -e "${YELLOW}   Запустите: ./setup-pm2.sh${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  PM2 не установлен${NC}"
    echo -e "${BLUE}   Установите: sudo npm install -g pm2${NC}"
fi
echo ""

# Проверка 5: Порт 5000
echo -e "${YELLOW}[5/8] Проверка порта 5000...${NC}"
if command -v lsof &> /dev/null; then
    PORT_CHECK=$(sudo lsof -i :5000 2>/dev/null | grep LISTEN)
    if [ -n "$PORT_CHECK" ]; then
        echo -e "${GREEN}✅ Порт 5000 занят процессом:${NC}"
        echo "$PORT_CHECK"
    else
        echo -e "${RED}❌ Порт 5000 не занят - backend не запущен!${NC}"
    fi
elif command -v netstat &> /dev/null; then
    PORT_CHECK=$(sudo netstat -tulpn 2>/dev/null | grep :5000)
    if [ -n "$PORT_CHECK" ]; then
        echo -e "${GREEN}✅ Порт 5000 занят${NC}"
        echo "$PORT_CHECK"
    else
        echo -e "${RED}❌ Порт 5000 не занят - backend не запущен!${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Не могу проверить порт (lsof/netstat не установлены)${NC}"
fi
echo ""

# Проверка 6: Подключение к backend
echo -e "${YELLOW}[6/8] Проверка подключения к backend...${NC}"
if command -v curl &> /dev/null; then
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/api/auth/me 2>/dev/null)
    if [ "$RESPONSE" = "401" ] || [ "$RESPONSE" = "200" ]; then
        echo -e "${GREEN}✅ Backend отвечает (код: $RESPONSE)${NC}"
    elif [ "$RESPONSE" = "000" ]; then
        echo -e "${RED}❌ Backend не отвечает - не запущен или ошибка${NC}"
    else
        echo -e "${YELLOW}⚠️  Backend отвечает с кодом: $RESPONSE${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  curl не установлен, пропускаю проверку${NC}"
fi
echo ""

# Проверка 7: Логи PM2
echo -e "${YELLOW}[7/8] Последние логи PM2 (последние 10 строк)...${NC}"
if command -v pm2 &> /dev/null && pm2 list | grep -q "invoice-backend"; then
    echo -e "${BLUE}--- Логи ---${NC}"
    pm2 logs invoice-backend --lines 10 --nostream 2>/dev/null || echo "Не удалось получить логи"
    echo -e "${BLUE}--- Конец логов ---${NC}"
else
    echo -e "${YELLOW}⚠️  PM2 не настроен или процесс не запущен${NC}"
fi
echo ""

# Проверка 8: Nginx конфигурация
echo -e "${YELLOW}[8/8] Проверка Nginx...${NC}"
if command -v nginx &> /dev/null; then
    if sudo nginx -t 2>/dev/null; then
        echo -e "${GREEN}✅ Конфигурация Nginx корректна${NC}"
    else
        echo -e "${RED}❌ Ошибка в конфигурации Nginx${NC}"
        sudo nginx -t
    fi
    
    # Проверка логов Nginx
    if [ -f "/var/log/nginx/david-warehouse-error.log" ]; then
        echo -e "${BLUE}Последние ошибки Nginx:${NC}"
        sudo tail -5 /var/log/nginx/david-warehouse-error.log 2>/dev/null || echo "Не удалось прочитать логи"
    fi
else
    echo -e "${YELLOW}⚠️  Nginx не установлен${NC}"
fi
echo ""

# Резюме и рекомендации
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}📋 Резюме и рекомендации${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

if ! command -v pm2 &> /dev/null || ! pm2 list | grep -q "invoice-backend"; then
    echo -e "${RED}❌ Backend не запущен через PM2${NC}"
    echo -e "${YELLOW}Решение:${NC}"
    echo "   cd $PROJECT_DIR"
    echo "   chmod +x setup-pm2.sh"
    echo "   ./setup-pm2.sh"
    echo ""
fi

if [ -z "$PORT_CHECK" ] 2>/dev/null; then
    echo -e "${RED}❌ Backend не слушает на порту 5000${NC}"
    echo -e "${YELLOW}Решение:${NC}"
    echo "   1. Проверьте логи: pm2 logs invoice-backend"
    echo "   2. Убедитесь, что .env настроен правильно"
    echo "   3. Перезапустите: pm2 restart invoice-backend"
    echo ""
fi

echo -e "${BLUE}Полезные команды:${NC}"
echo "   pm2 status                    - Статус процессов"
echo "   pm2 logs invoice-backend      - Просмотр логов"
echo "   pm2 restart invoice-backend    - Перезапуск"
echo "   sudo systemctl status nginx    - Статус Nginx"
echo "   sudo tail -f /var/log/nginx/david-warehouse-error.log - Логи Nginx"
echo ""

