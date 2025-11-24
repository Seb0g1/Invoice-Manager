#!/bin/bash

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}🔄 Обновление проекта на сервере${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

PROJECT_DIR="${PROJECT_DIR:-/var/www/david-warehouse}"

if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${RED}❌ Директория проекта не найдена: $PROJECT_DIR${NC}"
    exit 1
fi

cd "$PROJECT_DIR"

# Проверка статуса Git
if [ ! -d ".git" ]; then
    echo -e "${RED}❌ Это не Git репозиторий${NC}"
    exit 1
fi

# Сохраняем локальные изменения
echo -e "${YELLOW}💾 Сохранение локальных изменений...${NC}"
if git diff --quiet && git diff --cached --quiet; then
    echo -e "${GREEN}✅ Нет локальных изменений${NC}"
else
    git stash push -m "Локальные изменения перед обновлением $(date +%Y-%m-%d_%H:%M:%S)"
    echo -e "${GREEN}✅ Локальные изменения сохранены в stash${NC}"
fi

# Получаем обновления
echo -e "${YELLOW}📥 Получение обновлений с GitHub...${NC}"
git pull origin main

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Ошибка при получении обновлений${NC}"
    echo -e "${YELLOW}💡 Попробуйте: git stash pop (чтобы вернуть локальные изменения)${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Код обновлён${NC}"

# Проверяем, есть ли сохранённые изменения
if git stash list | grep -q "Локальные изменения"; then
    echo ""
    echo -e "${YELLOW}⚠️  У вас есть сохранённые локальные изменения${NC}"
    echo -e "${BLUE}Чтобы вернуть их, выполните:${NC}"
    echo "   git stash list          # Посмотреть сохранённые изменения"
    echo "   git stash show          # Показать изменения"
    echo "   git stash pop           # Вернуть изменения"
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}📋 Следующие шаги${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "1. Пересоберите backend:"
echo "   cd backend && npm run build"
echo ""
echo "2. Перезапустите backend:"
echo "   pm2 restart invoice-backend"
echo ""
echo "3. Если нужно сменить пароль director:"
echo "   ./change-director-password.sh"
echo ""

