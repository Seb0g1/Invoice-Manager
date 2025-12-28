#!/bin/bash

# Скрипт для полной установки проекта davidsklad.ru с GitHub
# Использование: ./full-install.sh [GITHUB_URL]
# Пример: ./full-install.sh https://github.com/YOUR_USERNAME/david-warehouse.git

set -e

echo "🚀 Полная установка проекта davidsklad.ru с GitHub"
echo "=================================================="

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Проверка прав sudo
if [ "$EUID" -ne 0 ]; then 
   echo -e "${RED}❌ Запустите скрипт с sudo${NC}"
   echo -e "${YELLOW}Использование: sudo ./full-install.sh [GITHUB_URL]${NC}"
   exit 1
fi

# Получение URL репозитория
GITHUB_URL="${1:-}"
if [ -z "$GITHUB_URL" ]; then
    echo -e "${YELLOW}⚠️  URL репозитория не указан${NC}"
    read -p "Введите URL репозитория GitHub (например: https://github.com/USERNAME/david-warehouse.git): " GITHUB_URL
    if [ -z "$GITHUB_URL" ]; then
        echo -e "${RED}❌ URL репозитория обязателен${NC}"
        exit 1
    fi
fi

PROJECT_DIR="/var/www/davidsklad"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

echo -e "${CYAN}📋 Параметры установки:${NC}"
echo -e "   Репозиторий: ${GREEN}$GITHUB_URL${NC}"
echo -e "   Директория: ${GREEN}$PROJECT_DIR${NC}"
echo ""
read -p "Продолжить установку? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Установка отменена${NC}"
    exit 1
fi

# ============================================
# ШАГ 1: Обновление системы
# ============================================
echo -e "\n${GREEN}📦 Шаг 1: Обновление системы...${NC}"
apt update
apt upgrade -y

# ============================================
# ШАГ 2: Установка Git
# ============================================
echo -e "\n${GREEN}📦 Шаг 2: Установка Git...${NC}"
if ! command -v git &> /dev/null; then
    apt install -y git
else
    echo -e "${YELLOW}   Git уже установлен${NC}"
fi

# ============================================
# ШАГ 3: Установка Node.js
# ============================================
echo -e "\n${GREEN}📦 Шаг 3: Установка Node.js...${NC}"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt install -y nodejs
    echo -e "${GREEN}   Node.js установлен: $(node --version)${NC}"
else
    echo -e "${YELLOW}   Node.js уже установлен: $(node --version)${NC}"
fi

# ============================================
# ШАГ 4: Установка PM2
# ============================================
echo -e "\n${GREEN}📦 Шаг 4: Установка PM2...${NC}"
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
    echo -e "${GREEN}   PM2 установлен${NC}"
else
    echo -e "${YELLOW}   PM2 уже установлен${NC}"
fi

# ============================================
# ШАГ 5: Установка Nginx
# ============================================
echo -e "\n${GREEN}📦 Шаг 5: Установка Nginx...${NC}"
if ! command -v nginx &> /dev/null; then
    apt install -y nginx
    systemctl enable nginx
    echo -e "${GREEN}   Nginx установлен${NC}"
else
    echo -e "${YELLOW}   Nginx уже установлен${NC}"
fi

# ============================================
# ШАГ 6: Установка Certbot
# ============================================
echo -e "\n${GREEN}📦 Шаг 6: Установка Certbot...${NC}"
if ! command -v certbot &> /dev/null; then
    apt install -y certbot python3-certbot-nginx
    echo -e "${GREEN}   Certbot установлен${NC}"
else
    echo -e "${YELLOW}   Certbot уже установлен${NC}"
fi

# ============================================
# ШАГ 7: Проверка MongoDB
# ============================================
echo -e "\n${GREEN}📊 Шаг 7: Проверка MongoDB...${NC}"
if systemctl is-active --quiet mongod; then
    echo -e "${GREEN}   MongoDB запущена${NC}"
else
    echo -e "${YELLOW}   ⚠️  MongoDB не запущена${NC}"
    echo -e "${YELLOW}   Убедитесь, что MongoDB установлена и запущена${NC}"
    read -p "Продолжить без MongoDB? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}Установка прервана${NC}"
        exit 1
    fi
fi

# ============================================
# ШАГ 8: Создание директории проекта
# ============================================
echo -e "\n${GREEN}📁 Шаг 8: Создание директории проекта...${NC}"
if [ -d "$PROJECT_DIR" ]; then
    echo -e "${YELLOW}   Директория уже существует${NC}"
    read -p "Удалить существующую директорию и переустановить? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf "$PROJECT_DIR"
        echo -e "${GREEN}   Старая директория удалена${NC}"
    else
        echo -e "${YELLOW}   Используем существующую директорию${NC}"
    fi
fi

mkdir -p "$PROJECT_DIR"
chown -R $SUDO_USER:$SUDO_USER "$PROJECT_DIR"
echo -e "${GREEN}   Директория создана: $PROJECT_DIR${NC}"

# ============================================
# ШАГ 9: Клонирование проекта с GitHub
# ============================================
echo -e "\n${GREEN}📥 Шаг 9: Клонирование проекта с GitHub...${NC}"
cd "$PROJECT_DIR"

if [ -d ".git" ]; then
    echo -e "${YELLOW}   Git репозиторий уже существует${NC}"
    read -p "Обновить существующий репозиторий? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git pull origin main || {
            echo -e "${YELLOW}   Не удалось обновить. Клонируем заново...${NC}"
            cd ..
            rm -rf "$PROJECT_DIR"
            mkdir -p "$PROJECT_DIR"
            chown -R $SUDO_USER:$SUDO_USER "$PROJECT_DIR"
            cd "$PROJECT_DIR"
            git clone "$GITHUB_URL" .
        }
    fi
else
    git clone "$GITHUB_URL" .
    chown -R $SUDO_USER:$SUDO_USER "$PROJECT_DIR"
fi

echo -e "${GREEN}   Проект клонирован${NC}"

# ============================================
# ШАГ 10: Настройка переменных окружения
# ============================================
echo -e "\n${GREEN}⚙️  Шаг 10: Настройка переменных окружения...${NC}"

# Backend .env
if [ ! -f "$BACKEND_DIR/.env" ]; then
    echo -e "${YELLOW}   Создание backend/.env...${NC}"
    cat > "$BACKEND_DIR/.env" << EOF
PORT=5000
MONGO_URI=mongodb://localhost:27017/davidsklad
JWT_SECRET=$(openssl rand -base64 32)
FRONTEND_URL=https://davidsklad.ru
BACKEND_URL=https://davidsklad.ru
EOF
    echo -e "${GREEN}   backend/.env создан${NC}"
    echo -e "${YELLOW}   ⚠️  Отредактируйте backend/.env и добавьте необходимые переменные${NC}"
else
    echo -e "${YELLOW}   backend/.env уже существует${NC}"
fi

# Frontend .env.production
if [ ! -f "$FRONTEND_DIR/.env.production" ]; then
    echo -e "${YELLOW}   Создание frontend/.env.production...${NC}"
    cat > "$FRONTEND_DIR/.env.production" << EOF
VITE_API_URL=https://davidsklad.ru/api
EOF
    echo -e "${GREEN}   frontend/.env.production создан${NC}"
else
    echo -e "${YELLOW}   frontend/.env.production уже существует${NC}"
fi

# ============================================
# ШАГ 11: Установка зависимостей и сборка
# ============================================
echo -e "\n${GREEN}🏗️  Шаг 11: Установка зависимостей и сборка...${NC}"

# Backend
echo -e "${CYAN}   Backend: установка зависимостей (включая devDependencies для сборки)...${NC}"
cd "$BACKEND_DIR"
npm install

echo -e "${CYAN}   Backend: сборка...${NC}"
npm run build

# Frontend
echo -e "${CYAN}   Frontend: установка зависимостей (включая devDependencies для сборки)...${NC}"
cd "$FRONTEND_DIR"
npm install

echo -e "${CYAN}   Frontend: сборка...${NC}"
npm run build

# Создание директорий
mkdir -p "$BACKEND_DIR/uploads"
mkdir -p "$BACKEND_DIR/logs"
chown -R $SUDO_USER:$SUDO_USER "$PROJECT_DIR"

# ============================================
# ШАГ 12: Настройка PM2
# ============================================
echo -e "\n${GREEN}🚀 Шаг 12: Настройка PM2...${NC}"
cd "$BACKEND_DIR"

if pm2 list | grep -q "davidsklad-backend"; then
    echo -e "${YELLOW}   Приложение уже запущено в PM2${NC}"
    pm2 restart davidsklad-backend
else
    pm2 start ecosystem.config.js
    pm2 save
    pm2 startup
    echo -e "${GREEN}   Приложение запущено в PM2${NC}"
    echo -e "${YELLOW}   ⚠️  Выполните команду, которую вывел pm2 startup${NC}"
fi

# ============================================
# ШАГ 13: Настройка Nginx
# ============================================
echo -e "\n${GREEN}🌐 Шаг 13: Настройка Nginx...${NC}"

NGINX_CONFIG="/etc/nginx/sites-available/davidsklad"
NGINX_ENABLED="/etc/nginx/sites-enabled/davidsklad"

if [ -f "$NGINX_CONFIG" ]; then
    echo -e "${YELLOW}   Конфигурация Nginx уже существует${NC}"
    read -p "Перезаписать конфигурацию? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -f "$NGINX_CONFIG"
    else
        echo -e "${YELLOW}   Используем существующую конфигурацию${NC}"
    fi
fi

if [ ! -f "$NGINX_CONFIG" ]; then
    cat > "$NGINX_CONFIG" << 'EOF'
# Редирект с HTTP на HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name davidsklad.ru www.davidsklad.ru;
    
    return 301 https://$server_name$request_uri;
}

# Основной сервер (HTTPS)
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name davidsklad.ru www.davidsklad.ru;

    # SSL сертификаты (будут установлены через Certbot)
    ssl_certificate /etc/letsencrypt/live/davidsklad.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/davidsklad.ru/privkey.pem;
    
    # SSL настройки
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Максимальный размер загружаемых файлов
    client_max_body_size 20M;

    # Логи
    access_log /var/log/nginx/davidsklad-access.log;
    error_log /var/log/nginx/davidsklad-error.log;

    # Статические файлы (uploads)
    location /uploads {
        alias /var/www/davidsklad/backend/uploads;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # API Backend
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Frontend (React приложение)
    location / {
        root /var/www/davidsklad/frontend/dist;
        try_files $uri $uri/ /index.html;
        expires 1d;
        add_header Cache-Control "public, must-revalidate";
    }

    # Отключение кэширования для index.html
    location = /index.html {
        root /var/www/davidsklad/frontend/dist;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
    }
}
EOF
    echo -e "${GREEN}   Конфигурация Nginx создана${NC}"
fi

# Активация конфигурации
if [ ! -L "$NGINX_ENABLED" ]; then
    ln -s "$NGINX_CONFIG" "$NGINX_ENABLED"
fi

# Проверка конфигурации
nginx -t && systemctl reload nginx
echo -e "${GREEN}   Nginx настроен и перезагружен${NC}"

# ============================================
# ШАГ 14: Настройка Firewall
# ============================================
echo -e "\n${GREEN}🔥 Шаг 14: Настройка Firewall...${NC}"
if command -v ufw &> /dev/null; then
    ufw allow OpenSSH
    ufw allow 'Nginx Full'
    ufw --force enable
    echo -e "${GREEN}   Firewall настроен${NC}"
else
    echo -e "${YELLOW}   UFW не установлен, пропускаем${NC}"
fi

# ============================================
# ИТОГИ
# ============================================
echo -e "\n${GREEN}✅ Установка завершена!${NC}"
echo -e "\n${CYAN}📋 Следующие шаги:${NC}"
echo -e "1. ${YELLOW}Отредактируйте переменные окружения:${NC}"
echo -e "   - nano $BACKEND_DIR/.env"
echo -e "   - nano $FRONTEND_DIR/.env.production"
echo ""
echo -e "2. ${YELLOW}Установите SSL сертификат:${NC}"
echo -e "   sudo certbot --nginx -d davidsklad.ru -d www.davidsklad.ru"
echo ""
echo -e "3. ${YELLOW}Проверьте статус приложения:${NC}"
echo -e "   pm2 status"
echo -e "   pm2 logs davidsklad-backend"
echo ""
echo -e "4. ${YELLOW}Откройте в браузере:${NC}"
echo -e "   https://davidsklad.ru"
echo ""
echo -e "${GREEN}🎉 Готово!${NC}"

