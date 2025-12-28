# Генерация и использование OpenAPI клиента для Яндекс Маркет API

Этот документ описывает процесс генерации TypeScript клиента из OpenAPI спецификации Яндекс Маркет API и его интеграцию в проект.

## 📋 Содержание

1. [Быстрый старт](#быстрый-старт)
2. [Подробные инструкции](#подробные-инструкции)
3. [Интеграция в проект](#интеграция-в-проект)
4. [Примеры использования](#примеры-использования)
5. [Обновление клиента](#обновление-клиента)

## 🚀 Быстрый старт

### Шаг 1: Клонирование спецификации

В корневой директории проекта выполните:

```bash
git clone https://github.com/yandex-market/yandex-market-partner-api.git temp-openapi-repo
```

### Шаг 2: Генерация клиента

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

### Шаг 3: Использование

После генерации клиент будет доступен в `backend/src/generated/yandex-market-api/`

## 📖 Подробные инструкции

### Предварительные требования

1. **Node.js и npm** - уже установлены в проекте
2. **OpenAPI генератор** - установлен как dev зависимость:
   ```bash
   cd backend
   npm install --save-dev @openapitools/openapi-generator-cli
   ```
3. **Java JDK 8+** - требуется для работы генератора
   - Windows: скачать с [Oracle](https://www.oracle.com/java/technologies/downloads/)
   - Linux: `sudo apt-get install default-jdk`
   - macOS: `brew install openjdk@11`

### Структура репозитория спецификации

После клонирования структура будет следующей:

```
temp-openapi-repo/
  ├── openapi/
  │   └── openapi.yaml    <- Основной файл спецификации
  └── ...
```

### Параметры генерации

- **Генератор**: `typescript-axios` - генерирует TypeScript клиент с использованием Axios
- **Выходная директория**: `backend/src/generated/yandex-market-api`
- **Дополнительные свойства**:
  - `supportsES6=true` - поддержка ES6+
  - `withInterfaces=true` - генерация TypeScript интерфейсов
  - `typescriptThreePlus=true` - поддержка TypeScript 3+

## 🔌 Интеграция в проект

### Вариант 1: Использование примера обертки

Создан файл `backend/src/integrations/yandex-market-client-example.ts` с готовой оберткой:

```typescript
import { yandexMarketApiClient } from '../integrations/yandex-market-client-example';

// Получить офферы
const mappings = await yandexMarketApiClient.getOfferMappings(businessId, {
  limit: 1000,
});

// Получить остатки
const stocks = await yandexMarketApiClient.getStocks(businessId, {
  skus: ['SKU1', 'SKU2'],
});

// Получить цены
const prices = await yandexMarketApiClient.getPrices(businessId);

// Обновить цены
const result = await yandexMarketApiClient.updatePrices(businessId, [
  {
    offerId: 'OFFER1',
    price: {
      value: '1000.00',
      currencyId: 'RUR',
    },
  },
]);
```

### Вариант 2: Прямое использование сгенерированного клиента

```typescript
import { Configuration, DefaultApi } from '../generated/yandex-market-api';
import { YandexBusiness } from '../models/YandexBusiness';

// Получить бизнес из БД
const business = await YandexBusiness.findOne({ businessId, enabled: true });

// Создать конфигурацию
const configuration = new Configuration({
  basePath: 'https://api.partner.market.yandex.ru',
  accessToken: business.accessToken,
});

// Создать экземпляр API
const api = new DefaultApi(configuration);

// Использовать методы API
const response = await api.getBusinessesBusinessIdOfferMappings(
  businessId,
  1000,  // limit
  undefined  // pageToken
);

console.log(response.data);
```

### Вариант 3: Интеграция в существующий сервис

Можно постепенно мигрировать `yandexMarketService.ts` на использование сгенерированного клиента:

```typescript
// В yandexMarketService.ts
import { Configuration, DefaultApi } from '../generated/yandex-market-api';

class YandexMarketService {
  private apiInstances: Map<string, DefaultApi> = new Map();

  async getApiInstance(businessId: string): Promise<DefaultApi | null> {
    if (this.apiInstances.has(businessId)) {
      return this.apiInstances.get(businessId)!;
    }

    const business = await YandexBusiness.findOne({ businessId, enabled: true });
    if (!business || !business.accessToken) {
      return null;
    }

    const configuration = new Configuration({
      basePath: 'https://api.partner.market.yandex.ru',
      accessToken: business.accessToken,
    });

    const api = new DefaultApi(configuration);
    this.apiInstances.set(businessId, api);

    return api;
  }

  // Постепенно заменяем методы на использование сгенерированного клиента
  async getOfferMappings(businessId: string) {
    const api = await this.getApiInstance(businessId);
    if (!api) throw new Error('Бизнес не настроен');
    
    return await api.getBusinessesBusinessIdOfferMappings(businessId);
  }
}
```

## 💡 Примеры использования

### Получение всех офферов с пагинацией

```typescript
async function getAllOfferMappings(businessId: string) {
  const api = await getApiInstance(businessId);
  const allMappings = [];
  let pageToken: string | undefined = undefined;

  while (true) {
    const response = await api.getBusinessesBusinessIdOfferMappings(
      businessId,
      1000,
      pageToken
    );

    allMappings.push(...response.data.result.offerMappings);

    pageToken = response.data.result.paging?.nextPageToken;
    if (!pageToken) break;

    // Небольшая задержка между запросами
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  return allMappings;
}
```

### Массовое обновление цен

```typescript
async function updateAllPrices(
  businessId: string,
  prices: Array<{ offerId: string; price: number }>
) {
  const api = await getApiInstance(businessId);
  const batchSize = 1000;

  for (let i = 0; i < prices.length; i += batchSize) {
    const batch = prices.slice(i, i + batchSize).map(p => ({
      offerId: p.offerId,
      price: {
        value: p.price.toFixed(2),
        currencyId: 'RUR',
      },
    }));

    await api.putBusinessesBusinessIdOfferPricesUpdates(businessId, {
      offers: batch,
    });

    // Задержка между батчами
    if (i + batchSize < prices.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
}
```

### Обработка ошибок

```typescript
try {
  const response = await api.getBusinessesBusinessIdOfferMappings(businessId);
  // Обработка успешного ответа
} catch (error: any) {
  if (error.response) {
    // Ошибка от API
    const status = error.response.status;
    const message = error.response.data?.errors?.[0]?.message;
    
    if (status === 401) {
      // Токен истек, нужно обновить
      console.error('Токен истек');
    } else if (status === 429) {
      // Rate limit
      console.error('Превышен лимит запросов');
    } else {
      console.error(`Ошибка API: ${message}`);
    }
  } else {
    // Сетевая ошибка
    console.error('Сетевая ошибка:', error.message);
  }
}
```

## 🔄 Обновление клиента

Когда Яндекс обновляет спецификацию API:

1. **Обновите репозиторий спецификации**:
   ```bash
   cd temp-openapi-repo
   git pull
   cd ..
   ```

2. **Перегенерируйте клиент**:
   ```bash
   cd backend
   npx @openapitools/openapi-generator-cli generate -i "../temp-openapi-repo/openapi/openapi.yaml" -g typescript-axios -o "src/generated/yandex-market-api" --additional-properties=supportsES6=true,withInterfaces=true,typescriptThreePlus=true
   ```

3. **Проверьте изменения**:
   - Проверьте, какие методы изменились
   - Обновите код, использующий устаревшие методы
   - Запустите тесты

## 📝 Примечания

- Сгенерированный клиент **НЕ коммитится** в Git (добавлен в `.gitignore`)
- Репозиторий спецификации также не коммитится
- При первой генерации процесс может занять несколько минут
- Методы API могут меняться при обновлении спецификации
- Всегда проверяйте документацию Яндекс Маркет API при обновлении

## 🔗 Полезные ссылки

- [Репозиторий спецификации](https://github.com/yandex-market/yandex-market-partner-api)
- [Документация OpenAPI Generator](https://openapi-generator.tech/docs/generators)
- [Документация Яндекс Маркет API](https://yandex.ru/dev/market/partner-api/doc/ru/)
- [Список всех генераторов](https://openapi-generator.tech/docs/generators)

## ❓ Часто задаваемые вопросы

### Нужна ли Java для генерации?

Да, OpenAPI генератор требует Java JDK 8 или выше. Если Java не установлена, генератор не будет работать.

### Можно ли использовать другой HTTP клиент вместо Axios?

Да, можно использовать другие генераторы:
- `typescript-fetch` - для fetch API
- `typescript-node` - для Node.js без дополнительных зависимостей

### Как добавить перехватчики запросов?

Вы можете настроить Axios через `baseOptions` в Configuration:

```typescript
const configuration = new Configuration({
  basePath: 'https://api.partner.market.yandex.ru',
  accessToken: business.accessToken,
  baseOptions: {
    timeout: 60000,
    headers: {
      'Custom-Header': 'value',
    },
  },
});
```

### Как обработать rate limiting?

Сгенерированный клиент использует Axios, поэтому можно добавить перехватчик:

```typescript
import axios from 'axios';

// Добавить перехватчик для retry при 429
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 429) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      return axios.request(error.config);
    }
    return Promise.reject(error);
  }
);
```






