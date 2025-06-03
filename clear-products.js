import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

console.log('Запуск скрипта для удаления всех товаров...');

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
  // Проверяем наличие таблицы products
  const tables = db.query("SELECT name FROM sqlite_master WHERE type='table'");
  console.log(`Таблицы в базе данных: ${tables.map(t => t.name).join(', ')}`);
  
  if (tables.some(t => t.name === 'products')) {
    // Получаем количество товаров перед удалением
    const productCount = db.query("SELECT COUNT(*) as count FROM products")[0].count;
    console.log(`В базе данных ${productCount} товаров`);
    
    // Удаляем все товары
    db.run("DELETE FROM products");
    console.log("Все товары удалены из базы данных");
    
    // Сбрасываем последовательность ID
    try {
      db.exec('UPDATE sqlite_sequence SET seq = 0 WHERE name = "products"');
      console.log('Последовательность ID товаров сброшена.');
    } catch (error) {
      console.log('Не удалось сбросить последовательность ID (возможно, не используется AUTOINCREMENT).');
    }
    
    // Проверяем после удаления
    const afterProductCount = db.query("SELECT COUNT(*) as count FROM products")[0].count;
    console.log(`После удаления в базе данных ${afterProductCount} товаров`);
  } else {
    console.log("Таблица products не найдена в базе данных");
  }
} catch (error) {
  console.error('Ошибка при удалении товаров:', error);
}

// Закрываем соединение с базой данных
sqlite.close();

console.log('Скрипт завершен!'); 