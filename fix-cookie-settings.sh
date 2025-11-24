#!/bin/bash

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}🍪 Исправление настроек cookies${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

PROJECT_DIR="${PROJECT_DIR:-/var/www/david-warehouse}"
BACKEND_DIR="$PROJECT_DIR/backend"

cd "$BACKEND_DIR"

# Проверка .env
if [ ! -f ".env" ]; then
    echo -e "${RED}❌ Файл .env не найден${NC}"
    exit 1
fi

echo -e "${YELLOW}Проверка FRONTEND_URL в .env...${NC}"

# Проверяем текущее значение
CURRENT_URL=$(grep "^FRONTEND_URL=" .env | cut -d'=' -f2)

if [ -z "$CURRENT_URL" ]; then
    echo -e "${YELLOW}⚠️  FRONTEND_URL не установлен. Добавляю...${NC}"
    echo "FRONTEND_URL=http://david.sakoo.ru" >> .env
    echo -e "${GREEN}✅ FRONTEND_URL установлен${NC}"
elif [[ "$CURRENT_URL" == *"https://"* ]]; then
    echo -e "${YELLOW}⚠️  FRONTEND_URL использует HTTPS: $CURRENT_URL${NC}"
    echo -e "${YELLOW}   Но сайт работает по HTTP!${NC}"
    echo ""
    read -p "Изменить на HTTP? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Заменяем https на http
        sed -i 's|FRONTEND_URL=https://david.sakoo.ru|FRONTEND_URL=http://david.sakoo.ru|g' .env
        echo -e "${GREEN}✅ FRONTEND_URL изменён на http://david.sakoo.ru${NC}"
    else
        echo -e "${YELLOW}⚠️  FRONTEND_URL не изменён${NC}"
    fi
else
    echo -e "${GREEN}✅ FRONTEND_URL правильный: $CURRENT_URL${NC}"
fi

echo ""
echo -e "${YELLOW}Текущие настройки:${NC}"
grep "^FRONTEND_URL=" .env

echo ""
echo -e "${BLUE}Перезапуск backend...${NC}"
pm2 restart invoice-backend

echo ""
echo -e "${GREEN}✅ Готово!${NC}"
echo ""
echo -e "${BLUE}Теперь попробуйте войти снова:${NC}"
echo "   Логин: director"
echo "   Пароль: CGJ-Ge-90"
echo ""
echo -e "${YELLOW}Cookies должны устанавливаться с:${NC}"
echo "   secure: false (для HTTP)"
echo "   sameSite: 'lax' (для HTTP)"

