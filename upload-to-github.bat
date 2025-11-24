@echo off
chcp 65001 >nul
echo ========================================
echo Загрузка проекта в GitHub
echo ========================================
echo.

REM Проверка наличия Git
where git >nul 2>&1
if %errorlevel% neq 0 (
    echo [ОШИБКА] Git не установлен!
    echo.
    echo Установите Git с https://git-scm.com/download/win
    echo Или используйте: winget install Git.Git
    pause
    exit /b 1
)

echo [✓] Git найден
echo.

REM Проверка, инициализирован ли репозиторий
if not exist .git (
    echo [1/7] Инициализация Git репозитория...
    git init
    if %errorlevel% neq 0 (
        echo [ОШИБКА] Не удалось инициализировать репозиторий
        pause
        exit /b 1
    )
    echo [✓] Репозиторий инициализирован
) else (
    echo [✓] Репозиторий уже инициализирован
)
echo.

echo [2/7] Добавление файлов...
git add .
if %errorlevel% neq 0 (
    echo [ОШИБКА] Не удалось добавить файлы
    pause
    exit /b 1
)
echo [✓] Файлы добавлены
echo.

echo [3/7] Создание коммита...
git commit -m "first commit"
if %errorlevel% neq 0 (
    echo [ПРЕДУПРЕЖДЕНИЕ] Возможно, нет изменений для коммита
)
echo.

echo [4/7] Переименование ветки в main...
git branch -M main
if %errorlevel% neq 0 (
    echo [ПРЕДУПРЕЖДЕНИЕ] Ветка уже называется main
)
echo.

echo [5/7] Проверка удалённого репозитория...
git remote get-url origin >nul 2>&1
if %errorlevel% neq 0 (
    echo [6/7] Добавление удалённого репозитория...
    git remote add origin https://github.com/Seb0g1/Invoice-Manager.git
    if %errorlevel% neq 0 (
        echo [ОШИБКА] Не удалось добавить удалённый репозиторий
        pause
        exit /b 1
    )
    echo [✓] Удалённый репозиторий добавлен
) else (
    echo [✓] Удалённый репозиторий уже настроен
)
echo.

echo [7/7] Загрузка проекта в GitHub...
echo.
echo ВНИМАНИЕ: Вам может потребоваться ввести логин и пароль GitHub
echo Или использовать Personal Access Token вместо пароля
echo.
git push -u origin main
if %errorlevel% neq 0 (
    echo.
    echo [ОШИБКА] Не удалось загрузить проект
    echo.
    echo Возможные причины:
    echo 1. Репозиторий не создан на GitHub
    echo 2. Неверные учётные данные
    echo 3. Репозиторий уже содержит файлы (используйте --force или сначала сделайте pull)
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo [✓] Проект успешно загружен в GitHub!
echo ========================================
echo.
echo Репозиторий: https://github.com/Seb0g1/Invoice-Manager
echo.
pause


