@echo off
chcp 65001 >nul
echo ========================================
echo Запуск Frontend (Vite Dev Server)
echo ========================================
echo.

REM Проверка Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ОШИБКА] Node.js не установлен!
    echo.
    echo Установите Node.js с https://nodejs.org/
    pause
    exit /b 1
)

echo [✓] Node.js найден
echo.

REM Переход в директорию frontend
cd /d "%~dp0frontend"
if not exist "package.json" (
    echo [ОШИБКА] Файл package.json не найден!
    echo Убедитесь, что вы находитесь в корне проекта
    pause
    exit /b 1
)

REM Проверка node_modules
if not exist "node_modules" (
    echo [1/2] Установка зависимостей...
    call npm install
    if %errorlevel% neq 0 (
        echo [ОШИБКА] Не удалось установить зависимости
        pause
        exit /b 1
    )
    echo [✓] Зависимости установлены
) else (
    echo [✓] Зависимости уже установлены
)
echo.

REM Запуск dev сервера
echo [2/2] Запуск Vite dev server...
echo.
echo Frontend будет доступен по адресу: http://localhost:3000
echo.
echo Для остановки нажмите Ctrl+C
echo.

call npm run dev

pause

