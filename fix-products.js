import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

console.log('Запуск скрипта для исправления товаров...');

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

// Создаем простой API для работы с базой данных (аналогично db-sqlite.ts)
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

// Проверяем наличие товаров с null ID
try {
  console.log('Проверка товаров с null ID...');
  
  // Проверяем структуру таблицы products
  const tableInfo = db.query("PRAGMA table_info(products)");
  console.log('Структура таблицы products:');
  tableInfo.forEach(col => {
    console.log(`  ${col.name} (${col.type}) ${col.pk ? 'PRIMARY KEY' : ''}`);
  });
  
  // Получаем все товары
  const products = db.query("SELECT * FROM products");
  console.log(`Найдено ${products.length} товаров.`);
  
  // Проверяем товары с null ID
  const nullIdProducts = products.filter(p => p.id === null);
  console.log(`Найдено ${nullIdProducts.length} товаров с null ID.`);
  
  if (nullIdProducts.length > 0) {
    console.log('Удаление товаров с null ID...');
    db.run("DELETE FROM products WHERE id IS NULL");
    console.log('Товары с null ID удалены.');
  }
  
  // Сбрасываем последовательность ID товаров
  try {
    db.exec('UPDATE sqlite_sequence SET seq = (SELECT MAX(id) FROM products) WHERE name = "products"');
    console.log('Последовательность ID товаров сброшена.');
  } catch (error) {
    console.log('Не удалось сбросить последовательность ID (возможно, не используется AUTOINCREMENT).');
  }
  
  // Проверяем товары после исправления
  const remainingProducts = db.query("SELECT * FROM products");
  console.log(`После исправления в базе ${remainingProducts.length} товаров.`);
  
  // Выводим все товары
  if (remainingProducts.length > 0) {
    console.log('\nСписок товаров:');
    remainingProducts.forEach(p => {
      console.log(`ID: ${p.id}, Название: ${p.name}, Категория: ${p.category}`);
    });
  }
  
} catch (error) {
  console.error('Ошибка при исправлении товаров:', error);
}

// Закрываем соединение с базой данных
sqlite.close();

console.log('Скрипт завершен!'); 