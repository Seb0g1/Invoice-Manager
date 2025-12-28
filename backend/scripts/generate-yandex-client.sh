#!/bin/bash
# Скрипт для генерации TypeScript клиента из OpenAPI спецификации Yandex Market Partner API

set -e

echo "=== Генерация TypeScript клиента для Yandex Market Partner API ==="

# Проверка наличия Java
echo ""
echo "[1/4] Проверка Java..."
if ! command -v java &> /dev/null; then
    echo "✗ Java не найден!"
    echo ""
    echo "Установите Java JDK 8+ или используйте Docker вариант (см. generate-yandex-client.md)"
    exit 1
fi
java -version
echo "✓ Java найден"

# Проверка наличия спецификации
echo ""
echo "[2/4] Проверка OpenAPI спецификации..."
SPEC_PATH="yandex-market-partner-api/openapi/openapi.yaml"
if [ ! -f "$SPEC_PATH" ]; then
    echo "✗ Спецификация не найдена: $SPEC_PATH"
    echo "Клонирую репозиторий..."
    git clone https://github.com/yandex-market/yandex-market-partner-api.git
    if [ ! -f "$SPEC_PATH" ]; then
        echo "✗ Не удалось клонировать репозиторий"
        exit 1
    fi
fi
echo "✓ Спецификация найдена"

# Удаление старого клиента (если есть)
echo ""
echo "[3/4] Очистка старого клиента..."
OUTPUT_PATH="src/integrations/yandex-market-api-client"
if [ -d "$OUTPUT_PATH" ]; then
    rm -rf "$OUTPUT_PATH"
    echo "✓ Старый клиент удален"
fi

# Генерация клиента
echo ""
echo "[4/4] Генерация TypeScript клиента..."
echo "Это может занять несколько минут..."

npx @openapitools/openapi-generator-cli generate \
  -i "$SPEC_PATH" \
  -g typescript-axios \
  -o "$OUTPUT_PATH" \
  --additional-properties=supportsES6=true,withInterfaces=true,typescriptThreePlus=true

if [ $? -eq 0 ]; then
    echo ""
    echo "✓ Клиент успешно сгенерирован в $OUTPUT_PATH"
    echo ""
    echo "Следующие шаги:"
    echo "1. Установите зависимости: cd $OUTPUT_PATH && npm install"
    echo "2. Обновите yandexMarketGoService.ts для использования нового клиента"
else
    echo ""
    echo "✗ Ошибка при генерации клиента"
    exit 1
fi
