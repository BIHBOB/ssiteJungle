import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

console.log('Запуск скрипта исправления структуры базы данных...');

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
  console.log('Начинаем исправление структуры таблицы products...');
  
  // 1. Сохраняем существующие данные
  let products = [];
  try {
    products = db.query("SELECT * FROM products");
    console.log(`Найдено ${products.length} товаров в базе данных`);
    console.log('Примеры товаров:');
    if (products.length > 0) {
      console.log(JSON.stringify(products[0], null, 2));
    }
  } catch (error) {
    console.log('Не удалось получить данные о товарах:', error.message);
  }
  
  // 2. Удаляем таблицу полностью
  try {
    db.exec("DROP TABLE IF EXISTS products");
    console.log('Таблица products удалена');
  } catch (error) {
    console.error('Ошибка при удалении таблицы products:', error.message);
  }
  
  // 3. Создаем таблицу с правильной структурой
  db.exec(`
    CREATE TABLE products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      original_price REAL,
      images TEXT,
      quantity INTEGER DEFAULT 0,
      category TEXT,
      is_available INTEGER DEFAULT 1,
      is_preorder INTEGER DEFAULT 0,
      is_rare INTEGER DEFAULT 0,
      is_easy_to_care INTEGER DEFAULT 0,
      labels TEXT,
      delivery_cost REAL DEFAULT 0,
      created_at TEXT,
      updated_at TEXT
    )
  `);
  console.log('Таблица products создана с правильной структурой');
  
  // 4. Восстанавливаем данные, но с новыми ID
  if (products.length > 0) {
    console.log('Восстанавливаем данные товаров...');
    
    let insertedCount = 0;
    for (const product of products) {
      try {
        // Игнорируем поле id, оно будет сгенерировано автоматически
        const result = db.run(`
          INSERT INTO products (
            name, description, price, original_price, 
            images, quantity, category, is_available, 
            is_preorder, is_rare, is_easy_to_care, 
            labels, delivery_cost, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          product.name || '',
          product.description || '',
          product.price || 0,
          product.original_price || null,
          product.images || '[]',
          product.quantity || 0,
          product.category || '',
          product.is_available || 0,
          product.is_preorder || 0,
          product.is_rare || 0,
          product.is_easy_to_care || 0,
          product.labels || '[]',
          product.delivery_cost || 0,
          product.created_at || new Date().toISOString(),
          product.updated_at || null
        ]);
        
        insertedCount++;
      } catch (insertError) {
        console.error('Ошибка при восстановлении товара:', insertError.message);
      }
    }
    
    console.log(`Восстановлено ${insertedCount} из ${products.length} товаров`);
  }
  
  // 5. Проверяем результат
  const newProducts = db.query("SELECT * FROM products");
  console.log(`После исправления в базе данных ${newProducts.length} товаров`);
  
  if (newProducts.length > 0) {
    console.log('Пример восстановленного товара:');
    console.log(JSON.stringify(newProducts[0], null, 2));
  }
  
  console.log('Структура таблицы products исправлена успешно!');
  
  // 6. Проверяем и создаем таблицу reviews (отзывы)
  console.log('Проверка таблицы отзывов (reviews)...');
  
  try {
    // Проверяем существование таблицы reviews
    const hasReviewsTable = db.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='reviews'"
    ).length > 0;
    
    if (!hasReviewsTable) {
      console.log('Создаем таблицу reviews...');
      
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
      
      console.log('Таблица reviews успешно создана!');
    } else {
      console.log('Таблица reviews уже существует');
    }
  } catch (error) {
    console.error('Ошибка при проверке/создании таблицы reviews:', error.message);
  }
  
} catch (error) {
  console.error('Ошибка при исправлении структуры базы данных:', error);
}

// Закрываем соединение с базой данных
sqlite.close();

console.log('Скрипт завершен!'); 