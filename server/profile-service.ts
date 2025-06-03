import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';

// Путь к базе данных
const DB_PATH = path.join(__dirname, '../db/database.sqlite');

// Типы данных
type ProfileData = {
  fullName?: string;
  email?: string;
  phone?: string;
  address?: string;
  username?: string;
};

class ProfileService {
  private db: Database | null = null;

  // Инициализация базы данных
  async init() {
    this.db = await open({
      filename: DB_PATH,
      driver: sqlite3.Database
    });

    await this.createTables();
  }

  // Создание таблиц
  private async createTables() {
    await this.db?.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS profiles (
        user_id INTEGER PRIMARY KEY,
        full_name TEXT,
        phone TEXT,
        address TEXT,
        FOREIGN KEY(user_id) REFERENCES users(id)
      );
    `);
  }

  // Обновление профиля
  async updateProfile(userId: number, data: ProfileData) {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.run(
      `INSERT OR REPLACE INTO profiles 
       (user_id, full_name, phone, address)
       VALUES (?, ?, ?, ?)`,
      [userId, data.fullName, data.phone, data.address]
    );

    // Обновляем email в основной таблице users
    if (data.email) {
      await this.db.run(
        `UPDATE users SET email = ? WHERE id = ?`,
        [data.email, userId]
      );
    }
  }

  // Получение профиля
  async getProfile(userId: number) {
    if (!this.db) throw new Error('Database not initialized');

    return await this.db.get(`
      SELECT u.id, u.username, u.email, 
             p.full_name as fullName, p.phone, p.address
      FROM users u
      LEFT JOIN profiles p ON u.id = p.user_id
      WHERE u.id = ?
    `, [userId]);
  }
}

// Экспорт singleton экземпляра
export default new ProfileService();