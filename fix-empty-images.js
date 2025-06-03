// Скрипт для создания base64-изображений вместо пустых файлов
import fs from 'fs';
import path from 'path';

console.log('Создание тестовых изображений...');

const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Простое однопиксельное PNG изображение в формате base64
const minimalPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z/C/HgAGgwJ/lK3Q6wAAAABJRU5ErkJggg==';
const pngBuffer = Buffer.from(minimalPngBase64, 'base64');

try {
  // Создаем файлы изображений
  fs.writeFileSync(path.join(uploadsDir, 'default-qr.png'), pngBuffer);
  console.log('Создан QR-код для оплаты');
  
  fs.writeFileSync(path.join(uploadsDir, 'default-plant.jpg'), pngBuffer);
  console.log('Создано изображение для товаров по умолчанию');
  
  console.log('Все изображения созданы успешно!');
} catch (error) {
  console.error('Ошибка при создании изображений:', error);
}

console.log('Скрипт завершен!');

// QR-код (упрощенный) в base64
 