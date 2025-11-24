#!/bin/bash

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}🔍 Диагностика авторизации${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

PROJECT_DIR="${PROJECT_DIR:-/var/www/david-warehouse}"
BACKEND_DIR="$PROJECT_DIR/backend"

cd "$PROJECT_DIR"

# Проверка 1: Backend запущен?
echo -e "${YELLOW}[1/5] Проверка backend...${NC}"
if pm2 list | grep -q "invoice-backend.*online"; then
    echo -e "${GREEN}✅ Backend запущен${NC}"
else
    echo -e "${RED}❌ Backend не запущен!${NC}"
    echo "   Запустите: pm2 start invoice-backend"
    exit 1
fi

# Проверка 2: Backend отвечает?
echo -e "${YELLOW}[2/5] Проверка доступности backend...${NC}"
if curl -s http://localhost:5000/api/currency/rate > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend отвечает на запросы${NC}"
else
    echo -e "${RED}❌ Backend не отвечает на порту 5000${NC}"
    echo "   Проверьте логи: pm2 logs invoice-backend"
    exit 1
fi

# Проверка 3: Тест входа
echo -e "${YELLOW}[3/5] Тест входа с новым паролем...${NC}"
LOGIN_RESPONSE=$(curl -s -i -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"login":"director","password":"CGJ-Ge-90"}' \
  -c /tmp/cookies-test.txt \
  -w "\nHTTP_CODE:%{http_code}")

HTTP_CODE=$(echo "$LOGIN_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
BODY=$(echo "$LOGIN_RESPONSE" | grep -v "HTTP_CODE" | grep -v "^HTTP" | grep -v "^Set-Cookie" | grep -v "^Content" | grep -v "^Date" | grep -v "^Connection" | grep -v "^X-" | tail -1)

# Проверяем Set-Cookie заголовок
SET_COOKIE=$(echo "$LOGIN_RESPONSE" | grep -i "Set-Cookie" | head -1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Вход успешен с паролем CGJ-Ge-90${NC}"
    echo "   Ответ: $BODY"
else
    echo -e "${RED}❌ Ошибка входа (код: $HTTP_CODE)${NC}"
    echo "   Ответ: $BODY"
    echo ""
    echo -e "${YELLOW}Пробуем старый пароль...${NC}"
    
    # Пробуем старый пароль
    OLD_RESPONSE=$(curl -s -X POST http://localhost:5000/api/auth/login \
      -H "Content-Type: application/json" \
      -d '{"login":"director","password":"12345"}' \
      -w "\nHTTP_CODE:%{http_code}")
    
    OLD_CODE=$(echo "$OLD_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
    if [ "$OLD_CODE" = "200" ]; then
        echo -e "${YELLOW}⚠️  Старый пароль (12345) всё ещё работает!${NC}"
        echo -e "${BLUE}   Нужно сменить пароль в базе данных${NC}"
        echo "   Выполните: ./change-director-password.sh"
    else
        echo -e "${RED}❌ Старый пароль тоже не работает${NC}"
        echo -e "${YELLOW}   Проверьте логи backend для деталей${NC}"
    fi
fi

# Проверка 4: Cookies
echo -e "${YELLOW}[4/5] Проверка cookies...${NC}"
if [ -n "$SET_COOKIE" ]; then
    echo -e "${GREEN}✅ Set-Cookie заголовок присутствует${NC}"
    echo "   $SET_COOKIE"
else
    echo -e "${YELLOW}⚠️  Set-Cookie заголовок не найден в ответе${NC}"
fi

if [ -f "/tmp/cookies-test.txt" ]; then
    COOKIE_VALUE=$(grep -i "token" /tmp/cookies-test.txt 2>/dev/null | awk '{print $7}')
    if [ -n "$COOKIE_VALUE" ]; then
        echo -e "${GREEN}✅ Cookie сохранена в файл${NC}"
        echo "   Токен: ${COOKIE_VALUE:0:30}..."
    else
        echo -e "${RED}❌ Cookie не сохранена в файл!${NC}"
        echo "   Содержимое файла cookies:"
        cat /tmp/cookies-test.txt
    fi
else
    echo -e "${YELLOW}⚠️  Файл cookies не создан${NC}"
fi

# Проверка 5: Проверка авторизации с cookies
echo -e "${YELLOW}[5/5] Проверка авторизации с cookies...${NC}"
if [ -f "/tmp/cookies-test.txt" ] && [ -n "$COOKIE_VALUE" ]; then
    AUTH_RESPONSE=$(curl -s http://localhost:5000/api/auth/me \
      -b /tmp/cookies-test.txt \
      -w "\nHTTP_CODE:%{http_code}")
    
    AUTH_CODE=$(echo "$AUTH_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
    AUTH_BODY=$(echo "$AUTH_RESPONSE" | grep -v "HTTP_CODE")
    
    if [ "$AUTH_CODE" = "200" ]; then
        echo -e "${GREEN}✅ Авторизация работает с cookies${NC}"
        echo "   Пользователь: $AUTH_BODY"
    else
        echo -e "${RED}❌ Ошибка авторизации (код: $AUTH_CODE)${NC}"
        echo "   Ответ: $AUTH_BODY"
    fi
else
    echo -e "${YELLOW}⚠️  Пропущено (нет cookies)${NC}"
fi

# Очистка
rm -f /tmp/cookies-test.txt

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}📋 Резюме${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Если вход не работает:"
echo "  1. Проверьте пароль в базе: ./change-director-password.sh"
echo "  2. Проверьте логи: pm2 logs invoice-backend --lines 50"
echo "  3. Проверьте .env: cat backend/.env | grep -E 'JWT_SECRET|FRONTEND_URL'"
echo ""

