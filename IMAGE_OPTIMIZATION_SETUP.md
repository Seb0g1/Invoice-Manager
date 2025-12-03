# 🖼️ Настройка оптимизации изображений

## Установка зависимостей

Для работы оптимизации изображений необходимо установить библиотеку `sharp`:

```bash
cd backend
npm install sharp
npm install --save-dev @types/sharp
```

## Интеграция в код

Утилита для оптимизации уже создана в `backend/src/utils/imageOptimizer.ts`.

### Интеграция в createInvoice

Откройте `backend/src/controllers/invoicesController.ts` и обновите функцию `createInvoice`:

```typescript
import { optimizeImage, deleteImageWithThumbnail } from '../utils/imageOptimizer';

export const createInvoice = async (req: AuthRequest, res: Response) => {
  try {
    // ... существующий код ...

    if (!req.file) {
      return res.status(400).json({ message: 'Фото накладной обязательно' });
    }

    // Оптимизируем изображение
    const originalPath = path.join(__dirname, '../../uploads', req.file.filename);
    const optimizedPath = path.join(__dirname, '../../uploads', `opt_${req.file.filename}`);
    
    try {
      const { optimizedPath: finalPath, thumbnailPath } = await optimizeImage(
        originalPath,
        optimizedPath,
        {
          maxWidth: 1920,
          maxHeight: 1920,
          quality: 85,
          format: 'jpeg',
          createThumbnail: true,
          thumbnailSize: 300
        }
      );

      // Удаляем оригинальное изображение, если оно было оптимизировано
      if (fs.existsSync(originalPath) && finalPath !== originalPath) {
        fs.unlinkSync(originalPath);
      }

      // Используем оптимизированное изображение
      const filename = path.basename(finalPath);
      const photoUrl = `/uploads/${filename}`;

      const invoice = new Invoice({
        photoUrl,
        // ... остальные поля ...
      });

      // ... остальной код ...
    } catch (optimizeError) {
      console.error('Image optimization error:', optimizeError);
      // Используем оригинальное изображение, если оптимизация не удалась
      const photoUrl = `/uploads/${req.file.filename}`;
      // ... создание invoice ...
    }
  } catch (error) {
    // ... обработка ошибок ...
  }
};
```

### Обновление deleteInvoice

Обновите функцию удаления накладной для удаления оптимизированного изображения и превью:

```typescript
import { deleteImageWithThumbnail } from '../utils/imageOptimizer';

export const deleteInvoice = async (req: AuthRequest, res: Response) => {
  try {
    // ... существующий код ...

    // Удаляем изображение и превью
    if (photoUrl) {
      const filename = photoUrl.replace('/uploads/', '');
      const filePath = path.join(__dirname, '../../uploads', filename);
      await deleteImageWithThumbnail(filePath);
    }

    // ... остальной код ...
  } catch (error) {
    // ... обработка ошибок ...
  }
};
```

## Использование превью на фронтенде

На фронтенде можно использовать превью для быстрой загрузки:

```typescript
// В компоненте отображения изображения
const getImageUrl = (photoUrl: string, useThumbnail = false) => {
  if (useThumbnail) {
    const filename = photoUrl.split('/').pop();
    return `/uploads/thumb_${filename}`;
  }
  return photoUrl;
};
```

## Преимущества

- ✅ **Уменьшение размера файлов:** Изображения сжимаются до 70-90% от оригинала
- ✅ **Быстрая загрузка:** Превью загружаются мгновенно
- ✅ **Экономия трафика:** Меньше данных передается
- ✅ **Лучший UX:** Быстрая загрузка превью, затем полное изображение

## Настройки оптимизации

Вы можете настроить параметры оптимизации в `imageOptimizer.ts`:

- `maxWidth/maxHeight`: Максимальные размеры (по умолчанию 1920px)
- `quality`: Качество JPEG (по умолчанию 85)
- `format`: Формат выходного файла (jpeg, png, webp)
- `thumbnailSize`: Размер превью (по умолчанию 300px)

---

**Примечание:** После установки `sharp` и интеграции кода, все новые загружаемые изображения будут автоматически оптимизироваться.

