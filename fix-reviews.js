import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

console.log('Запуск скрипта исправления отзывов...');

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
  
  queryOne: (sql, params = []) => {
    return sqlite.prepare(sql).get(params);
  },
  
  exec: (sql) => {
    return sqlite.exec(sql);
  },
  
  run: (sql, params = []) => {
    return sqlite.prepare(sql).run(params);
  }
};

try {
  console.log('Проверка существующих таблиц...');
  const tables = db.query("SELECT name FROM sqlite_master WHERE type='table'");
  const tableNames = tables.map(t => t.name);
  
  // Проверяем и создаем таблицу отзывов
  if (!tableNames.includes('reviews')) {
    console.log('Создание таблицы reviews...');
    db.exec(`
      CREATE TABLE reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
        text TEXT NOT NULL,
        images TEXT DEFAULT '[]',
        is_approved INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )
    `);
    console.log('Таблица reviews создана');
  } else {
    console.log('Исправление структуры таблицы reviews...');
    
    // Проверяем структуру таблицы reviews
    const tableInfo = db.query("PRAGMA table_info(reviews)");
    const columns = tableInfo.map(col => col.name);
    
    // Добавляем недостающие столбцы
    const requiredColumns = [
      'user_id', 'product_id', 'rating', 'text', 'images', 
      'is_approved', 'created_at', 'updated_at'
    ];
    
    for (const column of requiredColumns) {
      if (!columns.includes(column)) {
        let sql = '';
        switch(column) {
          case 'images':
            sql = `ALTER TABLE reviews ADD COLUMN ${column} TEXT DEFAULT '[]'`;
            break;
          case 'is_approved':
            sql = `ALTER TABLE reviews ADD COLUMN ${column} INTEGER DEFAULT 0`;
            break;
          case 'created_at':
          case 'updated_at':
            sql = `ALTER TABLE reviews ADD COLUMN ${column} TEXT DEFAULT CURRENT_TIMESTAMP`;
            break;
          default:
            sql = `ALTER TABLE reviews ADD COLUMN ${column} TEXT`;
        }
        
        try {
          db.exec(sql);
          console.log(`Добавлен столбец ${column} в таблицу reviews`);
        } catch(e) {
          console.error(`Ошибка при добавлении столбца ${column}:`, e);
        }
      }
    }
  }
  
  // Проверяем существующие отзывы
  console.log('Проверка отзывов...');
  const reviews = db.query("SELECT * FROM reviews");
  console.log(`Найдено ${reviews.length} отзывов`);
  
  // Создание тестовых отзывов, если их нет
  if (reviews.length === 0) {
    // Получаем список товаров
    const products = db.query("SELECT id FROM products LIMIT 5");
    const users = db.query("SELECT id FROM users LIMIT 3");
    
    if (products.length > 0 && users.length > 0) {
      console.log('Создание тестовых отзывов...');
      
      const sampleTexts = [
        "Очень доволен приобретением! Растение здоровое и красивое.",
        "Отличный магазин, быстрая доставка. Растение прижилось хорошо.",
        "Немного повредилось при доставке, но в целом неплохо. Сейчас активно растет.",
        "Прекрасное растение, уже дало новые побеги. Рекомендую!",
        "Не слишком впечатлен. Ожидал растение побольше размером."
      ];
      
      let addedCount = 0;
      
      for (const product of products) {
        for (const user of users) {
          if (Math.random() > 0.3) { // 70% шанс создать отзыв
            const rating = Math.floor(Math.random() * 4) + 2; // от 2 до 5
            const textIndex = Math.floor(Math.random() * sampleTexts.length);
            
            db.run(`
              INSERT INTO reviews (
                user_id, product_id, rating, text, is_approved, created_at
              ) VALUES (?, ?, ?, ?, ?, ?)
            `, [
              user.id,
              product.id,
              rating,
              sampleTexts[textIndex],
              Math.random() > 0.3 ? 1 : 0, // 70% шанс быть одобренным
              new Date().toISOString()
            ]);
            
            addedCount++;
          }
        }
      }
      
      console.log(`Создано ${addedCount} тестовых отзывов`);
    }
  }
  
  console.log('Исправление отзывов завершено успешно!');
  
} catch (error) {
  console.error('Ошибка при исправлении отзывов:', error);
}

// Закрываем соединение с базой данных
sqlite.close();

console.log('Скрипт завершен!'); 