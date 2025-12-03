#!/bin/bash

# Скрипт для первоначальной настройки сервера
# Использование: ./setup-server.sh

set -e

echo "🔧 Настройка сервера для davidsklad.ru..."

# Цвета
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Проверка прав sudo
if [ "$EUID" -ne 0 ]; then 
   echo -e "${RED}❌ Запустите скрипт с sudo${NC}"
   exit 1
fi

# 1. Обновление системы
echo -e "${GREEN}📦 Обновление системы...${NC}"
apt update
apt upgrade -y

# 2. Установка Node.js
echo -e "${GREEN}📦 Установка Node.js...${NC}"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt install -y nodejs
else
    echo -e "${YELLOW}⚠️  Node.js уже установлен${NC}"
fi

# 3. Установка PM2
echo -e "${GREEN}📦 Установка PM2...${NC}"
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
else
    echo -e "${YELLOW}⚠️  PM2 уже установлен${NC}"
fi

# 4. Установка Nginx
echo -e "${GREEN}📦 Установка Nginx...${NC}"
if ! command -v nginx &> /dev/null; then
    apt install -y nginx
else
    echo -e "${YELLOW}⚠️  Nginx уже установлен${NC}"
fi

# 5. Установка Certbot
echo -e "${GREEN}📦 Установка Certbot...${NC}"
if ! command -v certbot &> /dev/null; then
    apt install -y certbot python3-certbot-nginx
else
    echo -e "${YELLOW}⚠️  Certbot уже установлен${NC}"
fi

# 6. Создание директории проекта
echo -e "${GREEN}📁 Создание директории проекта...${NC}"
PROJECT_DIR="/var/www/davidsklad"
mkdir -p "$PROJECT_DIR"
chown -R $SUDO_USER:$SUDO_USER "$PROJECT_DIR"

# 7. Настройка Firewall
echo -e "${GREEN}🔥 Настройка Firewall...${NC}"
if command -v ufw &> /dev/null; then
    ufw allow OpenSSH
    ufw allow 'Nginx Full'
    ufw --force enable
else
    echo -e "${YELLOW}⚠️  UFW не установлен, пропускаем${NC}"
fi

# 8. Проверка MongoDB
echo -e "${GREEN}📊 Проверка MongoDB...${NC}"
if systemctl is-active --quiet mongod; then
    echo -e "${GREEN}✅ MongoDB запущена${NC}"
else
    echo -e "${YELLOW}⚠️  MongoDB не запущена. Убедитесь, что она установлена и запущена${NC}"
fi

echo -e "${GREEN}✅ Настройка сервера завершена!${NC}"
echo -e "${YELLOW}📝 Следующие шаги:${NC}"
echo -e "   1. Загрузите проект в $PROJECT_DIR"
echo -e "   2. Настройте .env файлы"
echo -e "   3. Запустите ./deploy.sh"

