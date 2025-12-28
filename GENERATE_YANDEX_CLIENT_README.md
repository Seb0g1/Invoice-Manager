# Генерация TypeScript клиента для Яндекс Маркет API

Это руководство описывает процесс генерации TypeScript клиента из OpenAPI спецификации Яндекс Маркета.

## Быстрый старт

### 1. Установка зависимостей

OpenAPI генератор уже установлен как dev зависимость. Если нужно установить глобально:

```bash
npm install -g @openapitools/openapi-generator-cli
```

### 2. Клонирование репозитория со спецификацией

В корневой директории проекта:

```bash
git clone https://github.com/yandex-market/yandex-market-partner-api.git temp-openapi-repo
```

### 3. Генерация клиента

#### Windows (PowerShell):

```powershell
cd backend
npx @openapitools/openapi-generator-cli generate -i "../temp-openapi-repo/openapi/openapi.yaml" -g typescript-axios -o "src/generated/yandex-market-api" --additional-properties=supportsES6=true,withInterfaces=true,typescriptThreePlus=true
```

#### Linux/macOS:

```bash
cd backend
npx @openapitools/openapi-generator-cli generate -i "../temp-openapi-repo/openapi/openapi.yaml" -g typescript-axios -o "src/generated/yandex-market-api" --additional-properties=supportsES6=true,withInterfaces=true,typescriptThreePlus=true
```

## Структура репозитория спецификации

После клонирования файл спецификации находится в:
```
temp-openapi-repo/openapi/openapi.yaml
```

## Результат генерации

Сгенерированный клиент будет создан в:
```
backend/src/generated/yandex-market-api/
```

## Использование сгенерированного клиента

После генерации клиент можно использовать следующим образом:

```typescript
import { Configuration, DefaultApi } from '../generated/yandex-market-api';

// Создаем конфигурацию
const configuration = new Configuration({
  basePath: 'https://api.partner.market.yandex.ru',
  accessToken: 'YOUR_OAUTH_TOKEN',
});

// Создаем экземпляр API
const api = new DefaultApi(configuration);

// Используем методы API
try {
  const result = await api.getBusinesses();
  console.log(result.data);
} catch (error) {
  console.error('Ошибка:', error);
}
```

## Интеграция с существующим сервисом

Сгенерированный клиент можно интегрировать в существующий `yandexMarketService.ts`:

```typescript
import { Configuration, DefaultApi } from '../generated/yandex-market-api';
import { YandexBusiness } from '../models/YandexBusiness';

class YandexMarketService {
  private apiInstances: Map<string, DefaultApi> = new Map();

  async getApiInstance(businessId: string): Promise<DefaultApi | null> {
    // Проверяем кэш
    if (this.apiInstances.has(businessId)) {
      return this.apiInstances.get(businessId)!;
    }

    // Загружаем бизнес из БД
    const business = await YandexBusiness.findOne({ businessId, enabled: true });
    if (!business || !business.accessToken) {
      return null;
    }

    // Создаем конфигурацию
    const configuration = new Configuration({
      basePath: 'https://api.partner.market.yandex.ru',
      accessToken: business.accessToken,
    });

    // Создаем экземпляр API
    const api = new DefaultApi(configuration);
    this.apiInstances.set(businessId, api);

    return api;
  }
}
```

## Обновление клиента

Когда Яндекс обновляет спецификацию API:

1. Обновите репозиторий спецификации:
   ```bash
   cd temp-openapi-repo
   git pull
   cd ..
   ```

2. Запустите генерацию заново (см. шаг 3)

## Примечания

- Сгенерированный клиент **НЕ** коммитится в Git (добавлен в `.gitignore`)
- Репозиторий спецификации также не коммитится (временная директория)
- При первой генерации процесс может занять несколько минут
- Убедитесь, что у вас достаточно места на диске

## Полезные ссылки

- [Репозиторий спецификации](https://github.com/yandex-market/yandex-market-partner-api)
- [Документация OpenAPI Generator](https://openapi-generator.tech/docs/generators)
- [Документация Яндекс Маркет API](https://yandex.ru/dev/market/partner-api/doc/ru/)

## Альтернативный способ: использование URL напрямую

Если у вас проблемы с клонированием репозитория, можно попробовать использовать URL к спецификации напрямую:

```bash
npx @openapitools/openapi-generator-cli generate -i "https://raw.githubusercontent.com/yandex-market/yandex-market-partner-api/main/openapi/openapi.yaml" -g typescript-axios -o "backend/src/generated/yandex-market-api" --additional-properties=supportsES6=true,withInterfaces=true,typescriptThreePlus=true
```

Однако этот способ может быть менее надежным, так как зависит от доступности GitHub.






