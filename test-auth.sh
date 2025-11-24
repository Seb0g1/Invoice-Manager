#!/bin/bash

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}🔍 Тест авторизации и cookies${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Тест 1: Вход
echo -e "${YELLOW}[1/3] Тест входа...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"login":"director","password":"12345"}' \
  -c /tmp/cookies.txt \
  -w "\nHTTP_CODE:%{http_code}")

HTTP_CODE=$(echo "$LOGIN_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
BODY=$(echo "$LOGIN_RESPONSE" | grep -v "HTTP_CODE")

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Вход успешен${NC}"
    echo "Ответ: $BODY"
else
    echo -e "${RED}❌ Ошибка входа (код: $HTTP_CODE)${NC}"
    echo "Ответ: $BODY"
    exit 1
fi

echo ""

# Проверка cookies
if [ -f "/tmp/cookies.txt" ]; then
    COOKIE_VALUE=$(grep -i "token" /tmp/cookies.txt | awk '{print $7}')
    if [ -n "$COOKIE_VALUE" ]; then
        echo -e "${GREEN}✅ Cookie установлена: ${COOKIE_VALUE:0:20}...${NC}"
    else
        echo -e "${RED}❌ Cookie не установлена!${NC}"
        cat /tmp/cookies.txt
    fi
else
    echo -e "${RED}❌ Файл cookies не создан!${NC}"
fi

echo ""

# Тест 2: Проверка авторизации с cookies
echo -e "${YELLOW}[2/3] Тест проверки авторизации с cookies...${NC}"
AUTH_RESPONSE=$(curl -s http://localhost:5000/api/auth/me \
  -b /tmp/cookies.txt \
  -w "\nHTTP_CODE:%{http_code}")

HTTP_CODE=$(echo "$AUTH_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
BODY=$(echo "$AUTH_RESPONSE" | grep -v "HTTP_CODE")

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Авторизация работает с cookies${NC}"
    echo "Ответ: $BODY"
else
    echo -e "${RED}❌ Ошибка авторизации (код: $HTTP_CODE)${NC}"
    echo "Ответ: $BODY"
    echo ""
    echo -e "${YELLOW}Проверьте:${NC}"
    echo "  1. Cookie передается в запросе"
    echo "  2. JWT_SECRET в .env правильный"
    echo "  3. Backend получает cookie"
fi

echo ""

# Тест 3: Проверка через Nginx
echo -e "${YELLOW}[3/3] Тест через Nginx (david.sakoo.ru)...${NC}"
NGINX_RESPONSE=$(curl -s http://david.sakoo.ru/api/auth/me \
  -b /tmp/cookies.txt \
  -w "\nHTTP_CODE:%{http_code}")

HTTP_CODE=$(echo "$NGINX_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
BODY=$(echo "$NGINX_RESPONSE" | grep -v "HTTP_CODE")

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Авторизация работает через Nginx${NC}"
    echo "Ответ: $BODY"
else
    echo -e "${RED}❌ Ошибка через Nginx (код: $HTTP_CODE)${NC}"
    echo "Ответ: $BODY"
    echo ""
    echo -e "${YELLOW}Проверьте конфигурацию Nginx:${NC}"
    echo "  - proxy_set_header Cookie \$http_cookie;"
    echo "  - Перезагрузите Nginx: sudo systemctl reload nginx"
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}📋 Резюме${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Файл cookies: /tmp/cookies.txt"
echo "Проверьте содержимое: cat /tmp/cookies.txt"

