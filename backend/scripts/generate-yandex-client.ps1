# Скрипт для генерации TypeScript клиента из OpenAPI спецификации Yandex Market Partner API

$ErrorActionPreference = "Stop"

Write-Host "=== Генерация TypeScript клиента для Yandex Market Partner API ===" -ForegroundColor Cyan

# Проверка наличия Java
Write-Host "`n[1/4] Проверка Java..." -ForegroundColor Yellow
try {
    $javaVersion = java -version 2>&1 | Select-Object -First 1
    Write-Host "✓ Java найден: $javaVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Java не найден!" -ForegroundColor Red
    Write-Host "`nУстановите Java JDK 8+ с https://www.oracle.com/java/technologies/downloads/" -ForegroundColor Yellow
    Write-Host "Или используйте Docker вариант (см. generate-yandex-client.md)" -ForegroundColor Yellow
    exit 1
}

# Определяем пути относительно backend директории
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Split-Path -Parent $scriptDir
$projectRoot = Split-Path -Parent $backendDir

# Проверка наличия спецификации
Write-Host "`n[2/4] Проверка OpenAPI спецификации..." -ForegroundColor Yellow
$repoDir = Join-Path $projectRoot "temp-openapi-repo"
$specPath = Join-Path $repoDir "openapi\openapi.yaml"

# Проверяем несколько возможных путей
if (-not (Test-Path $specPath)) {
    $specPath = Join-Path $repoDir "openapi.yaml"
}

if (-not (Test-Path $specPath)) {
    Write-Host "✗ Спецификация не найдена" -ForegroundColor Red
    Write-Host "Клонирую репозиторий в: $repoDir" -ForegroundColor Yellow
    
    if (-not (Test-Path $repoDir)) {
        Push-Location $projectRoot
        git clone https://github.com/yandex-market/yandex-market-partner-api.git temp-openapi-repo
        Pop-Location
        Start-Sleep -Seconds 2
    }
    
    # Проверяем снова
    $specPath = Join-Path $repoDir "openapi\openapi.yaml"
    if (-not (Test-Path $specPath)) {
        $specPath = Join-Path $repoDir "openapi.yaml"
    }
    
    if (-not (Test-Path $specPath)) {
        Write-Host "✗ Не удалось найти спецификацию после клонирования" -ForegroundColor Red
        Write-Host "Проверьте структуру репозитория: $repoDir" -ForegroundColor Yellow
        exit 1
    }
}
Write-Host "✓ Спецификация найдена: $specPath" -ForegroundColor Green

# Удаление старого клиента (если есть)
Write-Host "`n[3/4] Очистка старого клиента..." -ForegroundColor Yellow
$outputPath = Join-Path $backendDir "src\generated\yandex-market-api"
if (Test-Path $outputPath) {
    Remove-Item -Recurse -Force $outputPath
    Write-Host "✓ Старый клиент удален" -ForegroundColor Green
}

# Генерация клиента
Write-Host "`n[4/4] Генерация TypeScript клиента..." -ForegroundColor Yellow
Write-Host "Это может занять несколько минут..." -ForegroundColor Gray

Push-Location $backendDir

npx @openapitools/openapi-generator-cli generate `
  -i $specPath `
  -g typescript-axios `
  -o $outputPath `
  --additional-properties=supportsES6=true,withInterfaces=true,typescriptThreePlus=true,npmName=yandex-market-api-client

Pop-Location

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✓ Клиент успешно сгенерирован в $outputPath" -ForegroundColor Green
    Write-Host "`nСледующие шаги:" -ForegroundColor Cyan
    Write-Host "1. Установите зависимости: cd $outputPath && npm install" -ForegroundColor White
    Write-Host "2. Обновите yandexMarketGoService.ts для использования нового клиента" -ForegroundColor White
} else {
    Write-Host "`n✗ Ошибка при генерации клиента" -ForegroundColor Red
    exit 1
}
