import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Нормализует URL изображения, добавляя origin если это относительный путь
 */
export function normalizeImageUrl(url: string | null | undefined): string {
  if (!url) return '';
  
  // Абсолютный URL - возвращаем как есть
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // Относительный URL - добавляем origin
  if (url.startsWith('/')) {
    return `${window.location.origin}${url}`;
  }
  
  // Без начального слеша - добавляем
  return `${window.location.origin}/${url}`;
}
