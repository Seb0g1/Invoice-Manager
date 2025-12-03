import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

interface OptimizeOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
  createThumbnail?: boolean;
  thumbnailSize?: number;
}

/**
 * Оптимизирует изображение: сжимает и создает превью
 * @param inputPath - Путь к исходному изображению
 * @param outputPath - Путь для сохранения оптимизированного изображения
 * @param options - Опции оптимизации
 * @returns Путь к оптимизированному изображению и превью (если создано)
 */
export async function optimizeImage(
  inputPath: string,
  outputPath: string,
  options: OptimizeOptions = {}
): Promise<{ optimizedPath: string; thumbnailPath?: string }> {
  const {
    maxWidth = 1920,
    maxHeight = 1920,
    quality = 85,
    format = 'jpeg',
    createThumbnail = true,
    thumbnailSize = 300
  } = options;

  try {
    // Читаем метаданные изображения
    const metadata = await sharp(inputPath).metadata();
    
    // Определяем размеры для ресайза
    let width = metadata.width;
    let height = metadata.height;
    
    if (width && height) {
      // Вычисляем новые размеры с сохранением пропорций
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
    }

    // Оптимизируем изображение
    const image = sharp(inputPath)
      .resize(width, height, {
        fit: 'inside',
        withoutEnlargement: true
      });

    // Применяем формат и качество
    let optimizedImage;
    if (format === 'jpeg') {
      optimizedImage = image.jpeg({ quality, mozjpeg: true });
    } else if (format === 'png') {
      optimizedImage = image.png({ quality, compressionLevel: 9 });
    } else {
      optimizedImage = image.webp({ quality });
    }

    // Сохраняем оптимизированное изображение
    await optimizedImage.toFile(outputPath);

    let thumbnailPath: string | undefined;

    // Создаем превью (thumbnail)
    if (createThumbnail) {
      const thumbnailDir = path.dirname(outputPath);
      const thumbnailName = `thumb_${path.basename(outputPath)}`;
      thumbnailPath = path.join(thumbnailDir, thumbnailName);

      await sharp(inputPath)
        .resize(thumbnailSize, thumbnailSize, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: 80, mozjpeg: true })
        .toFile(thumbnailPath);
    }

    return {
      optimizedPath: outputPath,
      thumbnailPath
    };
  } catch (error) {
    console.error('Image optimization error:', error);
    throw new Error('Ошибка оптимизации изображения');
  }
}

/**
 * Получает путь к превью изображения
 * @param imagePath - Путь к оригинальному изображению
 * @returns Путь к превью или оригинальному изображению, если превью не найдено
 */
export function getThumbnailPath(imagePath: string): string {
  const dir = path.dirname(imagePath);
  const filename = path.basename(imagePath);
  const thumbnailPath = path.join(dir, `thumb_${filename}`);
  
  if (fs.existsSync(thumbnailPath)) {
    return thumbnailPath;
  }
  
  return imagePath;
}

/**
 * Удаляет изображение и его превью
 * @param imagePath - Путь к изображению
 */
export async function deleteImageWithThumbnail(imagePath: string): Promise<void> {
  try {
    // Удаляем оригинальное изображение
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }

    // Удаляем превью
    const thumbnailPath = getThumbnailPath(imagePath);
    if (fs.existsSync(thumbnailPath) && thumbnailPath !== imagePath) {
      fs.unlinkSync(thumbnailPath);
    }
  } catch (error) {
    console.error('Error deleting image:', error);
  }
}

/**
 * Проверяет, является ли файл изображением
 */
export function isImageFile(filename: string): boolean {
  const imageExtensions = /\.(jpg|jpeg|png|gif|webp)$/i;
  return imageExtensions.test(filename);
}

