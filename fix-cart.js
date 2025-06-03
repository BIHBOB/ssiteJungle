import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

console.log('Запуск скрипта исправления отображения корзины...');

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
  // Проверяем наличие таблицы carts
  const tables = db.query("SELECT name FROM sqlite_master WHERE type='table'");
  const tableNames = tables.map(t => t.name);
  
  if (!tableNames.includes('carts')) {
    console.log('Создание таблицы carts...');
    db.exec(`
      CREATE TABLE carts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        session_id TEXT,
        product_id INTEGER,
        quantity INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )
    `);
    console.log('Таблица carts создана');
  } else {
    console.log('Таблица carts уже существует');
  }
  
  // Проверяем наличие таблицы settings
  if (!tableNames.includes('settings')) {
    console.log('Создание таблицы settings...');
    db.exec(`
      CREATE TABLE settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        value TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Таблица settings создана');
    
    // Добавляем стоимость доставки
    db.run(`INSERT INTO settings (key, value) VALUES (?, ?)`, ['delivery_cost', '350']);
    console.log('Добавлена настройка стоимости доставки');
  }
  
  // Получаем таблицу продуктов для проверки
  console.log('Проверка товаров...');
  const products = db.query("SELECT * FROM products");
  console.log(`Найдено ${products.length} товаров`);
  
  for (const product of products) {
    console.log(`ID: ${product.id}, Название: ${product.name}, Цена: ${product.price}, Количество: ${product.quantity}`);
    
    // Если цена или количество нереалистичны, исправляем их
    if (product.price > 10000 || product.quantity > 100) {
      const newPrice = product.price > 10000 ? 1500 : product.price;
      const newQuantity = product.quantity > 100 ? 10 : product.quantity;
      
      db.run(
        "UPDATE products SET price = ?, quantity = ? WHERE id = ?",
        [newPrice, newQuantity, product.id]
      );
      
      console.log(`Исправлено для товара ${product.id}: Цена: ${newPrice}, Количество: ${newQuantity}`);
    }
  }
  
  console.log('Проверка и исправление корзины завершены успешно');
  
} catch (error) {
  console.error('Ошибка при исправлении корзины:', error);
}

// Закрываем соединение с базой данных
sqlite.close();

console.log('Скрипт завершен!'); 