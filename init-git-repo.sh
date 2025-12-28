#!/bin/bash

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}🔧 Инициализация Git репозитория${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Определение пути к проекту
PROJECT_DIR="${PROJECT_DIR:-/var/www/david-warehouse}"

# Проверка, что директория существует
if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${RED}❌ Директория проекта не найдена: $PROJECT_DIR${NC}"
    echo "   Установите переменную PROJECT_DIR или перейдите в директорию проекта"
    exit 1
fi

cd "$PROJECT_DIR"

# Проверка Git
if ! command -v git &> /dev/null; then
    echo -e "${RED}❌ Git не установлен${NC}"
    echo "   Установите Git: sudo apt install git -y"
    exit 1
fi

echo -e "${GREEN}✅ Git найден${NC}"
echo ""

# Вариант 1: Если это уже Git репозиторий, но без remote
if [ -d ".git" ]; then
    echo -e "${YELLOW}📋 Git репозиторий уже инициализирован${NC}"
    
    # Проверка remote
    if git remote get-url origin >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Remote 'origin' уже настроен${NC}"
        git remote -v
    else
        echo -e "${YELLOW}⚠️  Remote 'origin' не настроен${NC}"
        echo ""
        read -p "Добавить remote 'origin'? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            git remote add origin https://github.com/Seb0g1/Invoice-Manager.git
            echo -e "${GREEN}✅ Remote добавлен${NC}"
        fi
    fi
    
    # Проверка ветки
    CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "master")
    echo -e "${BLUE}Текущая ветка: $CURRENT_BRANCH${NC}"
    
    # Переименование в main, если нужно
    if [ "$CURRENT_BRANCH" != "main" ]; then
        read -p "Переименовать ветку в 'main'? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            git branch -M main
            echo -e "${GREEN}✅ Ветка переименована в 'main'${NC}"
        fi
    fi
    
    exit 0
fi

# Вариант 2: Инициализация нового репозитория
echo -e "${YELLOW}📋 Инициализация нового Git репозитория...${NC}"
echo ""

# Создание бэкапа текущих изменений (если есть)
if [ -n "$(ls -A $PROJECT_DIR 2>/dev/null)" ]; then
    echo -e "${YELLOW}💾 Создание резервной копии...${NC}"
    BACKUP_DIR="/tmp/david-warehouse-backup-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    # Копируем только важные файлы (исключая node_modules, dist и т.д.)
    rsync -av --exclude='node_modules' --exclude='dist' --exclude='.git' \
        --exclude='uploads' --exclude='.env' \
        "$PROJECT_DIR/" "$BACKUP_DIR/" 2>/dev/null || true
    echo -e "${GREEN}✅ Резервная копия создана: $BACKUP_DIR${NC}"
    echo ""
fi

# Инициализация Git
echo -e "${YELLOW}🔧 Инициализация Git...${NC}"
git init

# Добавление remote
echo -e "${YELLOW}🔗 Добавление remote 'origin'...${NC}"
git remote add origin https://github.com/Seb0g1/Invoice-Manager.git

# Настройка ветки
echo -e "${YELLOW}🌿 Настройка ветки 'main'...${NC}"
git branch -M main

# Получение данных с GitHub
echo ""
echo -e "${YELLOW}📥 Получение данных с GitHub...${NC}"
git fetch origin

# Проверка, есть ли файлы в репозитории
if [ -z "$(git ls-tree -r main --name-only 2>/dev/null)" ]; then
    echo -e "${YELLOW}⚠️  Репозиторий на GitHub пуст или ветка 'main' не существует${NC}"
    echo ""
    echo -e "${BLUE}Варианты:${NC}"
    echo "1. Если это новый проект, добавьте файлы и сделайте первый коммит"
    echo "2. Если проект уже на GitHub, проверьте название ветки"
    echo ""
    read -p "Продолжить настройку? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 0
    fi
fi

# Попытка связать с удаленной веткой
echo ""
echo -e "${YELLOW}🔗 Настройка связи с удаленной веткой...${NC}"

# Проверка существования локальных файлов
if [ -n "$(find . -maxdepth 1 -not -name '.git' -not -name '.' -not -name '..' 2>/dev/null)" ]; then
    echo -e "${YELLOW}⚠️  В директории есть файлы${NC}"
    echo ""
    echo -e "${BLUE}Выберите действие:${NC}"
    echo "1. Добавить существующие файлы и связать с GitHub (может вызвать конфликты)"
    echo "2. Очистить директорию и клонировать с GitHub (удалит локальные файлы!)"
    echo "3. Отменить"
    read -p "Ваш выбор (1/2/3): " choice
    
    case $choice in
        1)
            echo -e "${YELLOW}📝 Добавление файлов...${NC}"
            git add .
            if [ -n "$(git status --porcelain)" ]; then
                git commit -m "Initial commit from server" || true
            fi
            echo -e "${YELLOW}🔗 Настройка связи с origin/main...${NC}"
            git branch --set-upstream-to=origin/main main 2>/dev/null || true
            echo -e "${GREEN}✅ Готово! Теперь можно использовать: git pull origin main --allow-unrelated-histories${NC}"
            ;;
        2)
            echo -e "${RED}⚠️  ВНИМАНИЕ: Это удалит все локальные файлы!${NC}"
            read -p "Продолжить? (yes/no): " confirm
            if [ "$confirm" = "yes" ]; then
                cd ..
                rm -rf "$PROJECT_DIR"
                git clone https://github.com/Seb0g1/Invoice-Manager.git "$PROJECT_DIR"
                echo -e "${GREEN}✅ Проект клонирован с GitHub${NC}"
            else
                echo -e "${YELLOW}Отменено${NC}"
            fi
            ;;
        3)
            echo -e "${YELLOW}Отменено${NC}"
            exit 0
            ;;
        *)
            echo -e "${RED}Неверный выбор${NC}"
            exit 1
            ;;
    esac
else
    # Директория пуста, просто клонируем
    echo -e "${YELLOW}📥 Клонирование с GitHub...${NC}"
    cd ..
    rm -rf "$PROJECT_DIR"
    git clone https://github.com/Seb0g1/Invoice-Manager.git "$PROJECT_DIR"
    echo -e "${GREEN}✅ Проект клонирован с GitHub${NC}"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Git репозиторий настроен!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}📝 Следующие шаги:${NC}"
echo "   1. Убедитесь, что файл .env настроен в backend/"
echo "   2. Установите зависимости: cd backend && npm install"
echo "   3. Соберите проект: npm run build"
echo "   4. Сделайте то же самое для frontend"
echo "   5. Теперь можно использовать deploy.sh для обновлений"

