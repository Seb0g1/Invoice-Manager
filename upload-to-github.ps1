# Скрипт для загрузки проекта на GitHub
# Использование: .\upload-to-github.ps1

Write-Host "🚀 Подготовка проекта к загрузке на GitHub..." -ForegroundColor Green

# Проверка наличия git
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Git не установлен. Установите Git и повторите попытку." -ForegroundColor Red
    exit 1
}

# Переход в директорию проекта
$projectPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectPath

Write-Host "📁 Директория проекта: $projectPath" -ForegroundColor Cyan

# Проверка, инициализирован ли git
if (-not (Test-Path .git)) {
    Write-Host "🔧 Инициализация git репозитория..." -ForegroundColor Yellow
    git init
} else {
    Write-Host "✅ Git репозиторий уже инициализирован" -ForegroundColor Green
}

# Добавление всех файлов проекта
Write-Host "📦 Добавление файлов проекта в git..." -ForegroundColor Yellow
Write-Host "⚠️  Игнорируем системные файлы Windows (AppData, Documents и т.д.)" -ForegroundColor Yellow
git add . 2>&1 | Where-Object { $_ -notmatch "warning:" -and $_ -notmatch "error:" } | Out-Null

# Проверка статуса
$status = git status --short
if ($status) {
    Write-Host "📝 Файлы для коммита:" -ForegroundColor Cyan
    Write-Host $status
    
    # Создание коммита
    Write-Host "💾 Создание коммита..." -ForegroundColor Yellow
    git commit -m "Initial commit: David Warehouse - система управления складом и накладными"
    
    Write-Host "✅ Коммит создан успешно!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📤 Следующие шаги для загрузки на GitHub:" -ForegroundColor Cyan
    Write-Host "1. Создайте репозиторий на GitHub.com" -ForegroundColor White
    Write-Host "2. Выполните команды:" -ForegroundColor White
    Write-Host ""
    Write-Host "   git remote add origin https://github.com/YOUR_USERNAME/david-warehouse.git" -ForegroundColor Yellow
    Write-Host "   git branch -M main" -ForegroundColor Yellow
    Write-Host "   git push -u origin main" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "📖 Подробная инструкция: GITHUB_UPLOAD_INSTRUCTIONS.md" -ForegroundColor Cyan
} else {
    Write-Host "ℹ️  Нет изменений для коммита. Все файлы уже закоммичены." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "📤 Для загрузки на GitHub выполните:" -ForegroundColor Cyan
    Write-Host "   git remote add origin https://github.com/YOUR_USERNAME/david-warehouse.git" -ForegroundColor Yellow
    Write-Host "   git branch -M main" -ForegroundColor Yellow
    Write-Host "   git push -u origin main" -ForegroundColor Yellow
}

