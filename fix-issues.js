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
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(password, salt, 1000, 64, "sha512")
    .toString("hex");
  return `${salt}:${hash}`;
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

// Создаем простой API для работы с базой данных
const db = {
  // Выполнить запрос и вернуть результаты
  query: (sql, params = []) => {
    return sqlite.prepare(sql).all(params);
  },
  
  // Выполнить запрос и вернуть первый результат или null
  queryOne: (sql, params = []) => {
    return sqlite.prepare(sql).get(params);
  },
  
  // Выполнить запрос для вставки и вернуть ID
  insert: (sql, params = []) => {
    return sqlite.prepare(sql).run(params);
  },
  
  // Выполнить запрос для обновления и вернуть количество измененных строк
  update: (sql, params = []) => {
    return sqlite.prepare(sql).run(params);
  },
  
  // Выполнить произвольный запрос
  exec: (sql) => {
    return sqlite.exec(sql);
  }
};

// Создаем администратора
function createAdmin() {
  try {
    // Проверяем и создаем таблицу пользователей, если она не существует
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        password TEXT,
        first_name TEXT,
        last_name TEXT,
        is_admin BOOLEAN DEFAULT FALSE,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Проверяем существует ли админ с указанным email
    const existingUser = db.queryOne("SELECT * FROM users WHERE email = ?", ["fortnite08qwer@gmail.com"]);
    
    if (existingUser) {
      console.log('Админ уже существует, обновляем права доступа...');
      
      // Обновляем права доступа, если пользователь существует, но не админ
      if (!existingUser.is_admin) {
        db.update(
          "UPDATE users SET is_admin = ? WHERE email = ?",
          [1, "fortnite08qwer@gmail.com"]
        );
        console.log('Права администратора успешно обновлены');
      } else {
        console.log('Пользователь уже имеет права администратора');
      }
      
      return;
    }
    
    // Создаем нового администратора
    const userId = crypto.randomUUID();
    const hashedPassword = hashPassword("Plmokn09");
    
    db.insert(
      "INSERT INTO users (id, email, password, first_name, last_name, is_admin) VALUES (?, ?, ?, ?, ?, ?)",
      [userId, "fortnite08qwer@gmail.com", hashedPassword, "Admin", "User", 1]
    );
    
    console.log('Администратор успешно создан:');
    console.log('Email: fortnite08qwer@gmail.com');
    console.log('Пароль: Plmokn09');
    
  } catch (error) {
    console.error('Ошибка при создании администратора:', error);
  }
}

// Запускаем функции
createAdmin();

console.log('Скрипт завершен!'); 