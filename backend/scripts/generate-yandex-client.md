# Генерация TypeScript клиента для Yandex Market Partner API

## Требования

1. **Java JDK 8+** (обязательно для OpenAPI Generator)
   - Проверить: `java -version`
   - Скачать: https://www.oracle.com/java/technologies/downloads/

2. **OpenAPI Generator CLI** (уже установлен глобально)

## Генерация клиента

### Вариант 1: Использование npm (рекомендуется)

```bash
cd backend
npx @openapitools/openapi-generator-cli generate \
  -i yandex-market-partner-api/openapi/openapi.yaml \
  -g typescript-axios \
  -o src/integrations/yandex-market-api-client \
  --additional-properties=supportsES6=true,withInterfaces=true,typescriptThreePlus=true
```

### Вариант 2: Использование Docker (если Java не установлена)

```bash
cd backend
docker run --rm \
  -v "${PWD}:/local" \
  openapitools/openapi-generator-cli:v7.17.0 generate \
  -i /local/yandex-market-partner-api/openapi/openapi.yaml \
  -g typescript-axios \
  -o /local/src/integrations/yandex-market-api-client \
  --additional-properties=supportsES6=true,withInterfaces=true,typescriptThreePlus=true
```

## После генерации

1. Установить зависимости:
```bash
cd src/integrations/yandex-market-api-client
npm install
```

2. Обновить `yandexMarketGoService.ts` для использования сгенерированного клиента

## Обновление спецификации

Для обновления спецификации:
```bash
cd backend
git -C yandex-market-partner-api pull origin main
```

Затем перегенерировать клиент (см. выше).

