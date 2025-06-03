import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

console.log('Запуск скрипта для создания администратора...');

// Получаем текущую директорию
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Функция для хеширования паролей (копия из auth-sqlite.ts)
function hashPassword(password) {
  const salt = crypto.randomBytes(32).toString('hex'); // Используем 32 байта соли, как в auth-sqlite.ts
  const iterations = 10000; // Используем 10000 итераций
  const keylen = 64;
  const digest = 'sha512'; // Используем sha512
  const hash = crypto
    .pbkdf2Sync(password, salt, iterations, keylen, digest)
    .toString("hex");
  return `${salt}:${iterations}:${keylen}:${digest}:${hash}`;
}

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

// Удаляем существующего администратора (если есть)
try {
  // Используем email, который указан в start.bat
  sqlite.prepare("DELETE FROM users WHERE email = ?").run(["fortnite08qwer@gmail.com"]);
  console.log('Существующий пользователь с email fortnite08qwer@gmail.com был удален для создания нового');
} catch (error) {
  console.log('Не удалось удалить пользователя fortnite08qwer@gmail.com (возможно, его не было)');
}

// Создаем администратора
try {
  // Проверяем и создаем таблицу пользователей, если она не существует
  // Обновляем схему создания таблицы
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
  
  // Создаем нового администратора
  const userId = crypto.randomUUID();
  const adminEmail = "fortnite08qwer@gmail.com"; // Используем email из start.bat
  const password = "Plmokn09"; // Используем пароль из start.bat
  const hashedPassword = hashPassword(password);
  const now = new Date().toISOString();
  
  // Используем INSERT с учетом новой структуры таблицы
  const stmt = sqlite.prepare(
    `INSERT INTO users (
      id, email, password, username, full_name, phone, address, is_admin, balance, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  
  stmt.run([
    userId,
    adminEmail,
    hashedPassword,
    "admin", // username для админа
    "Admin User", // full_name для админа
    "", // phone
    "", // address
    1, // is_admin = 1
    '0.00', // balance
    now,
    now
  ]);
  
  console.log('Администратор успешно создан:');
  console.log(`Email: ${adminEmail}`);
  console.log(`Пароль: ${password}`);
  
  // Проверяем, что пользователь был создан
  const user = sqlite.prepare("SELECT * FROM users WHERE email = ?").get([adminEmail]);
  
  if (user) {
    console.log('Проверка: пользователь найден в базе данных');
    console.log(`ID: ${user.id}`);
    console.log(`Email: ${user.email}`);
    console.log(`Is Admin: ${Boolean(user.is_admin)}`);
    console.log(`Full Name: ${user.full_name}`);
    console.log(`Username: ${user.username}`);
  } else {
    console.log('Ошибка: пользователь не найден в базе после создания');
  }
  
} catch (error) {
  console.error('Ошибка при создании администратора:', error);
}

console.log('Скрипт завершен!'); 