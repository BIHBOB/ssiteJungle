import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

console.log('Запуск скрипта исправления платежных реквизитов...');

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
  console.log('Существующие таблицы:', tableNames.join(', '));
  
  // Удаляем таблицу payment_details, если она существует
  if (tableNames.includes('payment_details')) {
    console.log('Удаление существующей таблицы payment_details...');
    db.exec('DROP TABLE payment_details');
  }
  
  // Создаем новую таблицу payment_details
  console.log('Создание таблицы payment_details...');
  db.exec(`
    CREATE TABLE payment_details (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_number TEXT,
      card_holder TEXT,
      bank_name TEXT,
      qr_code_url TEXT,
      instructions TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('Таблица payment_details создана');
  
  // Добавляем дефолтную запись с реальными данными
  console.log('Добавление платежных реквизитов...');
  db.run(`
    INSERT INTO payment_details (
      card_number, card_holder, bank_name, qr_code_url, instructions
    ) VALUES (?, ?, ?, ?, ?)
  `, [
    '1234 5678 9012 3456', 
    'Jungle Plants', 
    'Тинькофф Банк', 
    '/uploads/default-qr.png', 
    'Для оплаты отсканируйте QR-код или переведите деньги на указанную карту'
  ]);
  console.log('Платежные реквизиты добавлены');
  
  // Проверяем и получаем текущие реквизиты
  const paymentDetails = db.queryOne("SELECT * FROM payment_details LIMIT 1");
  if (paymentDetails) {
    console.log('Текущие платежные реквизиты:', paymentDetails);
  } else {
    console.log('Не удалось получить платежные реквизиты');
  }
  
  // Проверяем и создаем папку для загрузки QR-кодов
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  
  // Создаем стандартный QR-код
  const defaultQrPath = path.join(uploadsDir, 'default-qr.png');
  if (!fs.existsSync(defaultQrPath)) {
    try {
      // Простое однопиксельное PNG изображение в формате base64
      const minimalPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z/C/HgAGgwJ/lK3Q6wAAAABJRU5ErkJggg==';
      const pngBuffer = Buffer.from(minimalPngBase64, 'base64');
      
      fs.writeFileSync(defaultQrPath, pngBuffer);
      console.log('Создан стандартный QR-код');
    } catch (e) {
      console.error('Не удалось создать стандартный QR-код:', e);
    }
  }
  
  console.log('Исправление платежных реквизитов завершено успешно!');
  
} catch (error) {
  console.error('Ошибка при исправлении платежных реквизитов:', error);
}

// Закрываем соединение с базой данных
sqlite.close();

console.log('Скрипт завершен!'); 