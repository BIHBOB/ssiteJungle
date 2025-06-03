import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

console.log('Запуск скрипта исправления таблиц платежных настроек...');

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
  
  // Проверяем и создаем таблицу payment_details, если она не существует
  if (!tableNames.includes('payment_details')) {
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
    
    // Добавляем дефолтную запись
    db.run(`
      INSERT INTO payment_details (
        card_number, card_holder, bank_name, qr_code_url, instructions
      ) VALUES (?, ?, ?, ?, ?)
    `, [
      '0000 0000 0000 0000', 
      'Jungle Plants', 
      'Российский банк', 
      '/uploads/default-qr.png', 
      'Для оплаты отсканируйте QR-код или переведите деньги на указанную карту'
    ]);
    console.log('Добавлена дефолтная запись в payment_details');
  } else {
    console.log('Таблица payment_details уже существует');
    
    // Проверяем наличие записей
    const paymentDetailsCount = db.queryOne("SELECT COUNT(*) as count FROM payment_details").count;
    if (paymentDetailsCount === 0) {
      // Добавляем дефолтную запись, если таблица пуста
      db.run(`
        INSERT INTO payment_details (
          card_number, card_holder, bank_name, qr_code_url, instructions
        ) VALUES (?, ?, ?, ?, ?)
      `, [
        '0000 0000 0000 0000', 
        'Jungle Plants', 
        'Российский банк', 
        '/uploads/default-qr.png', 
        'Для оплаты отсканируйте QR-код или переведите деньги на указанную карту'
      ]);
      console.log('Добавлена дефолтная запись в payment_details');
    } else {
      console.log(`В таблице payment_details уже есть ${paymentDetailsCount} записей`);
    }
  }
  
  // Проверяем и создаем таблицу settings, если она не существует
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
    
    // Добавляем дефолтные настройки
    const defaultSettings = [
      { key: 'delivery_cost', value: '350' },
      { key: 'free_delivery_threshold', value: '5000' },
      { key: 'store_phone', value: '+7 (999) 123-45-67' },
      { key: 'store_email', value: 'info@jungleplants.ru' },
      { key: 'store_address', value: 'г. Москва, ул. Примерная, д. 1' }
    ];
    
    for (const setting of defaultSettings) {
      db.run(`
        INSERT INTO settings (key, value) VALUES (?, ?)
      `, [setting.key, setting.value]);
    }
    console.log('Добавлены дефолтные настройки');
  } else {
    console.log('Таблица settings уже существует');
    
    // Проверяем наличие ключевых настроек
    const keysToCheck = ['delivery_cost', 'free_delivery_threshold', 'store_phone', 'store_email', 'store_address'];
    for (const key of keysToCheck) {
      const setting = db.queryOne("SELECT * FROM settings WHERE key = ?", [key]);
      if (!setting) {
        let defaultValue = '';
        switch (key) {
          case 'delivery_cost': defaultValue = '350'; break;
          case 'free_delivery_threshold': defaultValue = '5000'; break;
          case 'store_phone': defaultValue = '+7 (999) 123-45-67'; break;
          case 'store_email': defaultValue = 'info@jungleplants.ru'; break;
          case 'store_address': defaultValue = 'г. Москва, ул. Примерная, д. 1'; break;
        }
        
        db.run(`INSERT INTO settings (key, value) VALUES (?, ?)`, [key, defaultValue]);
        console.log(`Добавлена настройка ${key} со значением ${defaultValue}`);
      }
    }
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
      fs.writeFileSync(defaultQrPath, '');
      console.log('Создан стандартный QR-код');
    } catch (e) {
      console.error('Не удалось создать стандартный QR-код:', e);
    }
  }
  
  console.log('Исправление таблиц платежных настроек завершено успешно!');
  
} catch (error) {
  console.error('Ошибка при исправлении таблиц платежных настроек:', error);
}

// Закрываем соединение с базой данных
sqlite.close();

console.log('Скрипт завершен!'); 