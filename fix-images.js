import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

console.log('Запуск скрипта исправления изображений...');

// Создаем подключение к базе данных
const dbDir = path.join(process.cwd(), 'db');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'database.sqlite');
console.log(`База данных SQLite: ${dbPath}`);

const sqlite = new Database(dbPath);

// Включаем внешние ключи
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

// Создаем простой API для работы с базой данных
const db = {
  query: (sql, params = []) => {
    return sqlite.prepare(sql).all(params);
  },
  
  exec: (sql) => {
    return sqlite.exec(sql);
  },
  
  run: (sql, params = []) => {
    return sqlite.prepare(sql).run(params);
  }
};

try {
  // Получаем все товары с изображениями
  const products = db.query("SELECT * FROM products");
  console.log(`Найдено ${products.length} товаров в базе данных`);
  
  // Исправляем URL изображений для каждого товара
  for (const product of products) {
    try {
      let images = [];
      
      // Парсим текущие изображения
      if (product.images) {
        try {
          const currentImages = JSON.parse(product.images);
          
          // Исправляем каждый URL, только если это URL с Яндекса или других поисковых систем
          images = currentImages.map(url => {
            // Если это URL из поиска Яндекса или другой некорректный URL
            if (url.includes('yandex.ru/images/search') || 
                url.includes('search?') || 
                !url.match(/\.(jpg|jpeg|png|gif|webp)($|\?)/i)) {
              // Заменяем на стандартное изображение
              return '/uploads/default-plant.jpg';
            }
            return url;
          });
        } catch (e) {
          console.error(`Ошибка при парсинге изображений для товара ${product.id}:`, e);
          images = ['/uploads/default-plant.jpg'];
        }
      } else {
        // Если нет изображений, добавляем стандартное
        images = ['/uploads/default-plant.jpg'];
      }
      
      // Обновляем изображения товара
      db.run(
        "UPDATE products SET images = ? WHERE id = ?",
        [JSON.stringify(images), product.id]
      );
      
      console.log(`Обновлены изображения для товара ${product.id}`);
    } catch (error) {
      console.error(`Ошибка при обновлении изображений для товара ${product.id}:`, error);
    }
  }
  
  console.log('Изображения товаров обновлены успешно!');
  
  // Создаем папку uploads если её нет
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  
  // Создаем стандартное изображение для товаров без изображений
  const defaultImagePath = path.join(uploadsDir, 'default-plant.jpg');
  if (!fs.existsSync(defaultImagePath)) {
    // Создаем пустое изображение как пример
    // В реальности здесь нужно будет скопировать изображение из другого места
    try {
      fs.writeFileSync(defaultImagePath, '');
      console.log('Создано стандартное изображение для товаров');
    } catch (e) {
      console.error('Не удалось создать стандартное изображение:', e);
    }
  }
  
} catch (error) {
  console.error('Ошибка при исправлении изображений:', error);
}

// Закрываем соединение с базой данных
sqlite.close();

console.log('Скрипт завершен!'); 