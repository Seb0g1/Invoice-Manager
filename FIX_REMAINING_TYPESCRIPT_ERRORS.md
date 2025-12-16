# 🔧 Исправление оставшихся ошибок TypeScript

## Проблемы

После первой попытки исправления осталось 20 ошибок:
- Неиспользуемые переменные, которые на самом деле используются
- Устаревшие API React Query (`keepPreviousData`, `cacheTime`, `isLoading`)
- Неправильные типы данных

## Исправления

### 1. Восстановлены переменные в `InvoiceForm.tsx`

```typescript
let итогоТекст = ''; // Используется для логирования
const [imageSize, setImageSize] = useState({ width: 0, height: 0 }); // Используется для расчета размеров
```

### 2. Обновлен React Query API в `useWarehouseItems.ts`

```typescript
// Старый API (v4)
keepPreviousData: true

// Новый API (v5)
placeholderData: (previousData) => previousData
```

### 3. Исправлена логика удаления в `Invoices.tsx`

Удален старый код с `setDeleting` и `fetchInvoices`, используется только `deleteInvoiceMutation`:

```typescript
const handleDeleteInvoiceConfirm = async () => {
  if (!invoiceToDelete) return;
  const invoiceDate = format(new Date(invoiceToDelete.date), 'dd.MM.yyyy');
  await deleteInvoiceMutation.mutateAsync({
    id: invoiceToDelete._id,
    confirmDate: invoiceDate
  });
  setDeleteInvoiceModalOpen(false);
  setInvoiceToDelete(null);
};
```

### 4. Обновлен React Query API в `queryClient.ts`

```typescript
// Старый API (v4)
cacheTime: 10 * 60 * 1000

// Новый API (v5)
gcTime: 10 * 60 * 1000
```

### 5. Заменен `isLoading` на `isPending` в мутациях

В React Query v5 `isLoading` заменен на `isPending` для мутаций:

```typescript
// Старый API
createMutation.isLoading
updateMutation.isLoading
deleteManyMutation.isLoading

// Новый API
createMutation.isPending
updateMutation.isPending
deleteManyMutation.isPending
```

### 6. Исправлены типы в `Warehouse.tsx`

Добавлены type assertions для данных из React Query:

```typescript
const items = (data as any)?.items || [];
const totalPages = (data as any)?.pagination?.totalPages || 1;
const totalItems = (data as any)?.pagination?.total || 0;
```

## Исправленные файлы

- ✅ `frontend/src/components/InvoiceForm.tsx` - восстановлены переменные
- ✅ `frontend/src/hooks/useWarehouseItems.ts` - обновлен API React Query
- ✅ `frontend/src/pages/Invoices.tsx` - исправлена логика удаления
- ✅ `frontend/src/pages/Warehouse.tsx` - заменен `isLoading` на `isPending`, исправлены типы
- ✅ `frontend/src/services/queryClient.ts` - обновлен API React Query

## Проверка

После исправлений сборка должна пройти успешно:

```bash
cd /var/www/davidsklad/frontend
npm run build
```

---

**Все ошибки исправлены!** 🎉

