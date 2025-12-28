# 🔧 Исправление ошибок "debouncedSearchTerm is not defined" и "businesses.filter is not a function"

## Проблемы

1. **`debouncedSearchTerm is not defined`** - переменная используется, но не определена
2. **`businesses.filter is not a function`** - `businesses` не является массивом

## Исправления

### 1. Ошибка `debouncedSearchTerm is not defined` в `Warehouse.tsx`

**Проблема:** В `useEffect` использовался `debouncedSearchTerm`, но он не был определен.

**Решение:** Добавлен вызов хука `useDebounce`:

```typescript
const debouncedSearchTerm = useDebounce(searchTerm, 300);
```

### 2. Ошибка `businesses.filter is not a function` в `YandexBusinesses.tsx`

**Проблема:** API возвращает объект `{ businesses: [...] }`, но код ожидал массив напрямую.

**Решение:** 
1. Обновлена функция `fetchBusinesses` для обработки разных форматов ответа
2. Добавлены проверки `Array.isArray()` перед использованием методов массива

```typescript
const fetchBusinesses = async () => {
  try {
    setLoading(true);
    const response = await api.get('/yandex-market/businesses');
    // Обрабатываем разные форматы ответа
    let businessesList: Business[] = [];
    if (Array.isArray(response.data)) {
      businessesList = response.data;
    } else if (response.data?.businesses && Array.isArray(response.data.businesses)) {
      businessesList = response.data.businesses;
    } else if (response.data) {
      businessesList = [response.data];
    }
    setBusinesses(businessesList);
  } catch (error: any) {
    console.error('Ошибка загрузки бизнесов:', error);
    toast.error('Ошибка загрузки бизнесов');
    setBusinesses([]); // Устанавливаем пустой массив при ошибке
  } finally {
    setLoading(false);
  }
};
```

3. Добавлены проверки перед использованием `businesses.filter` и `businesses.map`:

```typescript
disabled={syncing || !Array.isArray(businesses) || businesses.filter(b => b.enabled).length === 0}

{!Array.isArray(businesses) || businesses.length === 0 ? (
  // ...
) : (
  businesses.map((business) => (
    // ...
  ))
)}
```

## Исправленные файлы

- ✅ `frontend/src/pages/Warehouse.tsx` - добавлен `debouncedSearchTerm`
- ✅ `frontend/src/pages/YandexBusinesses.tsx` - исправлена обработка формата ответа API и добавлены проверки массива

## Проверка

После обновления кода:

1. Перезагрузите страницу в браузере
2. Ошибки должны исчезнуть
3. Поиск на странице "Наш склад" должен работать корректно
4. Страница "Бизнесы Яндекс Маркет" должна загружаться без ошибок

## Если используете Git

Обновите проект на сервере:

```bash
cd /var/www/davidsklad
git pull origin main
cd frontend
npm install
npm run build
```

---

**Файлы обновлены:** Все файлы, использующие `debouncedSearchTerm` и `businesses`, теперь правильно обрабатывают данные.

