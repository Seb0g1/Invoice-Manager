#!/bin/bash

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}🔐 Смена пароля пользователя${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

PROJECT_DIR="${PROJECT_DIR:-/var/www/david-warehouse}"
BACKEND_DIR="$PROJECT_DIR/backend"

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

# Проверка .env
if [ ! -f ".env" ]; then
    echo -e "${RED}❌ Файл .env не найден${NC}"
    exit 1
fi

echo -e "${YELLOW}Введите логин пользователя:${NC}"
read USER_LOGIN

echo -e "${YELLOW}Введите новый пароль:${NC}"
read -s NEW_PASSWORD

echo ""
echo -e "${YELLOW}Подтвердите новый пароль:${NC}"
read -s CONFIRM_PASSWORD

if [ "$NEW_PASSWORD" != "$CONFIRM_PASSWORD" ]; then
    echo -e "${RED}❌ Пароли не совпадают${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Смена пароля для пользователя: $USER_LOGIN${NC}"

# Создаём временный скрипт для смены пароля
cat > /tmp/change-password-temp.js << EOF
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('./dist/models/User').default;

async function changePassword() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Подключено к MongoDB');
    
    const user = await User.findOne({ login: '$USER_LOGIN' });
    if (!user) {
      console.error('❌ Пользователь не найден');
      process.exit(1);
    }
    
    const hashedPassword = await bcrypt.hash('$NEW_PASSWORD', 10);
    user.password = hashedPassword;
    await user.save();
    
    console.log('✅ Пароль успешно изменён');
    process.exit(0);
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  }
}

changePassword();
EOF

# Запускаем скрипт
node /tmp/change-password-temp.js

# Удаляем временный файл
rm /tmp/change-password-temp.js

echo ""
echo -e "${GREEN}✅ Готово!${NC}"


