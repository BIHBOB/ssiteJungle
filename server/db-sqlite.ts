import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import Database from 'better-sqlite3';
import { IUser } from './types';
import { hashPassword } from './auth-utils';

// Инициализация базы данных (как у вас)
const dbDir = join(process.cwd(), 'db');
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

const dbPath = join(dbDir, 'database.sqlite');
const sqlite = new Database(dbPath);

sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

// Расширяем ваш объект db для работы с пользователями
export const db = {
  // Ваши существующие методы
  query: (sql: string, params: any[] = []) => sqlite.prepare(sql).all(params),
  queryOne: (sql: string, params: any[] = []) => sqlite.prepare(sql).get(params),
  insert: (sql: string, params: any[] = []) => sqlite.prepare(sql).run(params).lastInsertRowid,
  update: (sql: string, params: any[] = []) => sqlite.prepare(sql).run(params).changes,
  run: (sql: string, params: any[] = []) => sqlite.prepare(sql).run(params),
  delete: (sql: string, params: any[] = []) => sqlite.prepare(sql).run(params).changes,
  exec: (sql: string) => sqlite.exec(sql),

  // Новые методы для работы с пользователями
  getUserById: (id: string): IUser | null => {
    const user = sqlite.prepare('SELECT * FROM users WHERE id = ?').get(id);
    return user ? mapDbUser(user) : null;
  },

  getUserByEmail: (email: string): IUser | null => {
    const user = sqlite.prepare('SELECT * FROM users WHERE email = ?').get(email);
    return user ? mapDbUser(user) : null;
  },

  createUser: (userData: Omit<IUser, 'id'>): IUser => {
    const id = crypto.randomUUID();
    sqlite.prepare(`
      INSERT INTO users (id, email, password, first_name, last_name, is_admin)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      id,
      userData.email.toLowerCase(),
      hashPassword(userData.password),
      userData.firstName,
      userData.lastName,
      userData.isAdmin ? 1 : 0
    );
    return db.getUserById(id)!;
  }
};

function mapDbUser(dbUser: any): IUser {
  return {
    id: dbUser.id,
    email: dbUser.email,
    firstName: dbUser.first_name,
    lastName: dbUser.last_name,
    isAdmin: dbUser.is_admin === 1,
    password: dbUser.password
  };
}

// Создаем таблицу пользователей при первом запуске
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    is_admin INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);