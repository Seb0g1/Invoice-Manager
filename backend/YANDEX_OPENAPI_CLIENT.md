# Yandex Market Partner API - OpenAPI Client

## Обзор

Для работы с Yandex Market Partner API можно использовать автоматически сгенерированный TypeScript клиент из OpenAPI спецификации. Это обеспечивает:

- ✅ Типобезопасность
- ✅ Автодополнение в IDE
- ✅ Актуальность с API
- ✅ Меньше ручного кода

## Текущая реализация

Сейчас используется ручная реализация в `yandexMarketGoService.ts`, которая работает корректно, но требует ручного обновления при изменении API.

## Генерация клиента

### Требования

1. **Java JDK 8+** (обязательно)
   ```bash
   java -version
   ```
   Если Java не установлена:
   - Windows: https://www.oracle.com/java/technologies/downloads/
   - Linux: `sudo apt-get install openjdk-11-jdk` (или другой версии)
   - macOS: `brew install openjdk@11`

2. **OpenAPI Generator CLI** (уже установлен глобально)

### Быстрый старт

#### Windows (PowerShell)
```powershell
cd backend
.\scripts\generate-yandex-client.ps1
```

#### Linux/macOS (Bash)
```bash
cd backend
chmod +x scripts/generate-yandex-client.sh
./scripts/generate-yandex-client.sh
```

#### Ручная генерация
```bash
cd backend
npx @openapitools/openapi-generator-cli generate \
  -i yandex-market-partner-api/openapi/openapi.yaml \
  -g typescript-axios \
  -o src/integrations/yandex-market-api-client \
  --additional-properties=supportsES6=true,withInterfaces=true,typescriptThreePlus=true
```

### Использование Docker (если Java не установлена)

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

1. **Установить зависимости:**
   ```bash
   cd src/integrations/yandex-market-api-client
   npm install
   ```

2. **Обновить `yandexMarketGoService.ts`:**
   - Импортировать сгенерированные классы и типы
   - Использовать сгенерированный API клиент вместо прямых axios вызовов
   - Сохранить существующую логику авторизации и обработки ошибок

3. **Пример использования:**
   ```typescript
   import { DefaultApi, Configuration } from '../integrations/yandex-market-api-client';
   
   const config = new Configuration({
     basePath: 'https://api.partner.market.yandex.ru',
     accessToken: business.accessToken,
   });
   
   const api = new DefaultApi(config);
   const response = await api.getBusinessesOfferMappings(businessId, options);
   ```

## Обновление спецификации

Для получения последней версии спецификации:

```bash
cd backend/yandex-market-partner-api
git pull origin main
cd ..
# Затем перегенерировать клиент (см. выше)
```

## Преимущества сгенерированного клиента

1. **Типобезопасность**: Все типы генерируются из OpenAPI спецификации
2. **Актуальность**: Легко обновлять при изменении API
3. **Меньше ошибок**: IDE подсказывает правильные параметры
4. **Документация**: Типы содержат JSDoc комментарии из спецификации

## Миграция с текущей реализации

Текущая реализация в `yandexMarketGoService.ts` работает корректно. Миграция на сгенерированный клиент может быть выполнена постепенно:

1. Сгенерировать клиент
2. Создать обёртку, которая использует сгенерированный клиент
3. Постепенно переносить методы из текущей реализации
4. Протестировать каждый метод
5. Удалить старую реализацию

## Примечания

- Сгенерированный клиент требует настройки авторизации (Api-Key header)
- Некоторые методы могут требовать дополнительной обработки ответов
- Рекомендуется сохранить существующую логику retry и обработки ошибок

