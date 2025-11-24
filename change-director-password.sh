#!/bin/bash

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}🔐 Смена пароля для director${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

PROJECT_DIR="${PROJECT_DIR:-/var/www/david-warehouse}"
BACKEND_DIR="$PROJECT_DIR/backend"
NEW_PASSWORD="CGJ-Ge-90"

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

echo -e "${YELLOW}Смена пароля для пользователя 'director' на 'CGJ-Ge-90'...${NC}"

# Создаём временный скрипт для смены пароля
cat > /tmp/change-director-password.js << 'ENDOFSCRIPT'
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// Импортируем модель User
const UserSchema = new (require('mongoose').Schema)({
  login: String,
  password: String,
  role: String
}, { collection: 'users' });

const User = mongoose.models.User || mongoose.model('User', UserSchema);

async function changePassword() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Подключено к MongoDB');
    
    const user = await User.findOne({ login: 'director' });
    if (!user) {
      console.error('❌ Пользователь director не найден');
      process.exit(1);
    }
    
    const hashedPassword = await bcrypt.hash('CGJ-Ge-90', 10);
    user.password = hashedPassword;
    await user.save();
    
    console.log('✅ Пароль успешно изменён для пользователя director');
    console.log('   Новый пароль: CGJ-Ge-90');
    process.exit(0);
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

changePassword();
ENDOFSCRIPT

# Запускаем скрипт
node /tmp/change-director-password.js

RESULT=$?

# Удаляем временный файл
rm /tmp/change-director-password.js

if [ $RESULT -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Пароль успешно изменён!${NC}"
    echo ""
    echo -e "${BLUE}Новые учётные данные:${NC}"
    echo "   Логин: director"
    echo "   Пароль: CGJ-Ge-90"
else
    echo ""
    echo -e "${RED}❌ Ошибка при смене пароля${NC}"
    exit 1
fi

