import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

console.log('Запуск скрипта для исправления прав администратора...');

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

// Находим пользователя с email fortnite08qwer@gmail.com
const user = sqlite.prepare("SELECT * FROM users WHERE email = ?").get(["fortnite08qwer@gmail.com"]);

if (user) {
  console.log('Пользователь найден:');
  console.log(`ID: ${user.id}`);
  console.log(`Email: ${user.email}`);
  console.log(`Is Admin: ${Boolean(user.is_admin)}`);
  
  // Устанавливаем права администратора
  const stmt = sqlite.prepare("UPDATE users SET is_admin = 1 WHERE id = ?");
  const result = stmt.run([user.id]);
  
  if (result.changes > 0) {
    console.log('Права администратора успешно обновлены!');
    
    // Проверяем изменения
    const updatedUser = sqlite.prepare("SELECT * FROM users WHERE id = ?").get([user.id]);
    console.log(`Обновленный статус: is_admin = ${updatedUser.is_admin}`);
  } else {
    console.log('Не удалось обновить права администратора.');
  }
} else {
  console.log('Пользователь не найден. Создаем нового администратора...');
  // Здесь можно добавить код из setup-admin.js для создания администратора
}

console.log('Скрипт завершен!'); 