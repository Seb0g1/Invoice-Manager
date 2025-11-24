#!/bin/bash

echo "========================================"
echo "Загрузка проекта в GitHub"
echo "========================================"
echo ""

# Проверка наличия Git
if ! command -v git &> /dev/null; then
    echo "[ОШИБКА] Git не установлен!"
    echo ""
    echo "Установите Git:"
    echo "  Ubuntu/Debian: sudo apt install git"
    echo "  macOS: brew install git"
    exit 1
fi

echo "[✓] Git найден"
echo ""

# Проверка, инициализирован ли репозиторий
if [ ! -d .git ]; then
    echo "[1/7] Инициализация Git репозитория..."
    git init
    if [ $? -ne 0 ]; then
        echo "[ОШИБКА] Не удалось инициализировать репозиторий"
        exit 1
    fi
    echo "[✓] Репозиторий инициализирован"
else
    echo "[✓] Репозиторий уже инициализирован"
fi
echo ""

echo "[2/7] Добавление файлов..."
git add .
if [ $? -ne 0 ]; then
    echo "[ОШИБКА] Не удалось добавить файлы"
    exit 1
fi
echo "[✓] Файлы добавлены"
echo ""

echo "[3/7] Создание коммита..."
git commit -m "first commit"
if [ $? -ne 0 ]; then
    echo "[ПРЕДУПРЕЖДЕНИЕ] Возможно, нет изменений для коммита"
fi
echo ""

echo "[4/7] Переименование ветки в main..."
git branch -M main
if [ $? -ne 0 ]; then
    echo "[ПРЕДУПРЕЖДЕНИЕ] Ветка уже называется main"
fi
echo ""

echo "[5/7] Проверка удалённого репозитория..."
if ! git remote get-url origin &> /dev/null; then
    echo "[6/7] Добавление удалённого репозитория..."
    git remote add origin https://github.com/Seb0g1/Invoice-Manager.git
    if [ $? -ne 0 ]; then
        echo "[ОШИБКА] Не удалось добавить удалённый репозиторий"
        exit 1
    fi
    echo "[✓] Удалённый репозиторий добавлен"
else
    echo "[✓] Удалённый репозиторий уже настроен"
fi
echo ""

echo "[7/7] Загрузка проекта в GitHub..."
echo ""
echo "ВНИМАНИЕ: Вам может потребоваться ввести логин и пароль GitHub"
echo "Или использовать Personal Access Token вместо пароля"
echo ""
git push -u origin main
if [ $? -ne 0 ]; then
    echo ""
    echo "[ОШИБКА] Не удалось загрузить проект"
    echo ""
    echo "Возможные причины:"
    echo "1. Репозиторий не создан на GitHub"
    echo "2. Неверные учётные данные"
    echo "3. Репозиторий уже содержит файлы (используйте --force или сначала сделайте pull)"
    echo ""
    exit 1
fi

echo ""
echo "========================================"
echo "[✓] Проект успешно загружен в GitHub!"
echo "========================================"
echo ""
echo "Репозиторий: https://github.com/Seb0g1/Invoice-Manager"
echo ""


