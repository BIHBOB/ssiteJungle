import Database from 'better-sqlite3';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

// Убедимся, что папка для базы данных существует
const dbDir = join(process.cwd(), 'db');
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

const dbPath = join(dbDir, 'database.sqlite');
console.log(`Migrating SQLite database at: ${dbPath}`);

// Подключение к SQLite базе данных
const sqlite = new Database(dbPath);

// Включаем внешние ключи
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

// Выполнение миграции (создание таблиц на основе схемы)
try {
  console.log('Initializing SQLite schema...');
  
  // Таблица пользователей - Обновленная схема
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      username TEXT,
      full_name TEXT,
      phone TEXT,
      address TEXT,
      is_admin INTEGER DEFAULT 0,
      balance TEXT DEFAULT '0.00',
      created_at TEXT NOT NULL,
      updated_at TEXT
    )
  `);
  
  // Таблица сессий
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      expires_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Базовая таблица для товаров
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      original_price REAL,
      images TEXT,
      quantity INTEGER DEFAULT 0,
      category TEXT,
      is_available BOOLEAN DEFAULT TRUE,
      is_preorder BOOLEAN DEFAULT FALSE,
      is_rare BOOLEAN DEFAULT FALSE,
      is_easy_to_care BOOLEAN DEFAULT FALSE,
      labels TEXT,
      delivery_cost REAL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Таблица промокодов
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS promo_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      description TEXT,
      discount_type TEXT NOT NULL CHECK(discount_type IN ('percentage', 'fixed')),
      discount_value REAL NOT NULL,
      min_order_amount REAL DEFAULT 0,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      max_uses INTEGER,
      current_uses INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Таблица использования промокодов
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS promo_code_uses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      promo_code_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      order_id INTEGER NOT NULL,
      discount_amount REAL NOT NULL,
      used_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (promo_code_id) REFERENCES promo_codes(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (order_id) REFERENCES orders(id)
    )
  `);
  
  // Таблица отзывов
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
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
  
  // Таблица платежных реквизитов
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS payment_details (
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
  
  // Таблица заказов
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      items TEXT NOT NULL,
      total_amount REAL NOT NULL,
      delivery_amount REAL NOT NULL,
      full_name TEXT NOT NULL,
      address TEXT NOT NULL,
      phone TEXT NOT NULL,
      social_network TEXT,
      social_username TEXT,
      comment TEXT,
      need_insulation BOOLEAN DEFAULT 0,
      delivery_type TEXT NOT NULL,
      delivery_speed TEXT,
      payment_method TEXT NOT NULL,
      payment_status TEXT NOT NULL,
      order_status TEXT NOT NULL,
      payment_proof_url TEXT,
      admin_comment TEXT,
      tracking_number TEXT,
      estimated_delivery_date TEXT,
      actual_delivery_date TEXT,
      last_status_change_at TEXT,
      status_history TEXT,
      product_quantities_reduced BOOLEAN DEFAULT 0,
      promo_code TEXT,
      promo_code_discount REAL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  
  console.log('SQLite migrations completed successfully');
} catch (error) {
  console.error('Migration failed', error);
  process.exit(1);
} 