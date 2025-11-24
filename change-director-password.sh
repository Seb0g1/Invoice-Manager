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
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// Импортируем модель User из собранного кода
let User;
try {
  // Пробуем импортировать из dist
  const UserModule = require('./dist/models/User');
  User = UserModule.default || UserModule;
} catch (e) {
  // Если не собран, создаём схему вручную
  const UserSchema = new mongoose.Schema({
    login: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['director', 'collector'], required: true }
  }, { 
    collection: 'users',
    timestamps: true
  });
  User = mongoose.models.User || mongoose.model('User', UserSchema);
}

async function changePassword() {
  try {
    console.log('Подключение к MongoDB...');
    console.log('MONGO_URI:', process.env.MONGO_URI ? 'установлен' : 'не установлен');
    
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Подключено к MongoDB');
    
    const user = await User.findOne({ login: 'director' });
    if (!user) {
      console.error('❌ Пользователь director не найден');
      console.log('Доступные пользователи:');
      const allUsers = await User.find({}).select('login role');
      allUsers.forEach(u => console.log(`  - ${u.login} (${u.role})`));
      process.exit(1);
    }
    
    console.log(`Найден пользователь: ${user.login} (${user.role})`);
    console.log('Хеширование нового пароля...');
    
    const hashedPassword = await bcrypt.hash('CGJ-Ge-90', 10);
    user.password = hashedPassword;
    await user.save();
    
    console.log('✅ Пароль успешно изменён для пользователя director');
    console.log('   Новый пароль: CGJ-Ge-90');
    
    // Проверяем, что пароль действительно изменился
    const testUser = await User.findOne({ login: 'director' });
    const testMatch = await bcrypt.compare('CGJ-Ge-90', testUser.password);
    if (testMatch) {
      console.log('✅ Проверка: новый пароль работает');
    } else {
      console.error('❌ Ошибка: новый пароль не работает после сохранения');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Отключено от MongoDB');
  }
}

changePassword();
ENDOFSCRIPT

# Запускаем скрипт из директории backend, чтобы правильно загрузить .env
node /tmp/change-director-password.js

RESULT=$?

# Удаляем временный файл
rm -f /tmp/change-director-password.js

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

