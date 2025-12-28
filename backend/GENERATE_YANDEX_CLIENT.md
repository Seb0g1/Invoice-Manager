# Генерация TypeScript клиента для Яндекс Маркет API

Это руководство описывает процесс генерации TypeScript клиента из OpenAPI спецификации Яндекс Маркета.

## Предварительные требования

1. Node.js и npm установлены
2. Git установлен
3. OpenAPI генератор установлен как dev зависимость

## Установка генератора

Генератор уже установлен в проекте как dev зависимость. Если нужно установить глобально:

```bash
npm install -g @openapitools/openapi-generator-cli
```

## Генерация клиента

### Windows (PowerShell)

```bash
cd backend
npm run generate-yandex-client
```

Или напрямую:

```powershell
cd backend/scripts
powershell -ExecutionPolicy Bypass -File generate-yandex-client.ps1
```

### Linux/macOS

```bash
cd backend/scripts
chmod +x generate-yandex-client.sh
./generate-yandex-client.sh
```

## Что делает скрипт

1. **Клонирует репозиторий** с OpenAPI спецификацией (если еще не склонирован):
   ```bash
   git clone https://github.com/yandex-market/yandex-market-partner-api.git temp-openapi-repo
   ```

2. **Находит файл спецификации** `openapi.yaml` в клонированном репозитории

3. **Генерирует TypeScript клиент** с использованием генератора `typescript-axios`:
   - Генерируется в директории `backend/src/generated/yandex-market-api`
   - Используется Axios для HTTP запросов
   - Включаются TypeScript интерфейсы
   - Поддерживается ES6+

## Использование сгенерированного клиента

После генерации клиент будет доступен в:

```
backend/src/generated/yandex-market-api/
```

Пример использования:

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

Когда Яндекс обновляет спецификацию API, вы можете обновить клиент:

1. Обновите репозиторий спецификации:
   ```bash
   cd temp-openapi-repo
   git pull
   cd ..
   ```

2. Запустите генерацию заново:
   ```bash
   npm run generate-yandex-client
   ```

## Полезные ссылки

- [Репозиторий спецификации](https://github.com/yandex-market/yandex-market-partner-api)
- [Документация OpenAPI Generator](https://openapi-generator.tech/docs/generators)
- [Документация Яндекс Маркет API](https://yandex.ru/dev/market/partner-api/doc/ru/)

## Примечания

- Сгенерированный клиент **НЕ** должен коммититься в Git (добавлен в `.gitignore`)
- Репозиторий спецификации также не коммитится (временная директория)
- При первой генерации процесс может занять несколько минут
- Убедитесь, что у вас достаточно места на диске (генерация может создать много файлов)






