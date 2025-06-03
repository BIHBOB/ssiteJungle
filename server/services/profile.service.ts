import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'db', 'database.sqlite');
const db = new Database(dbPath);

// Включаем поддержку внешних ключей
db.pragma('foreign_keys = ON');

// Создаем таблицу профилей, если ее нет
db.exec(`
  CREATE TABLE IF NOT EXISTS user_profiles (
    user_id INTEGER PRIMARY KEY,
    full_name TEXT,
    phone TEXT,
    address TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`);

export const ProfileService = {
  async updateProfile(userId: number, data: {
    fullName?: string;
    phone?: string;
    address?: string;
  }) {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO user_profiles 
      (user_id, full_name, phone, address)
      VALUES (?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      userId,
      data.fullName,
      data.phone,
      data.address
    );

    return this.getProfile(userId);
  },

  async getProfile(userId: number) {
    const stmt = db.prepare(`
      SELECT 
        u.id, u.username, u.email,
        p.full_name as fullName, p.phone, p.address
      FROM users u
      LEFT JOIN user_profiles p ON u.id = p.user_id
      WHERE u.id = ?
    `);
    
    return stmt.get(userId);
  },

  async updateEmail(userId: number, newEmail: string) {
    const stmt = db.prepare(`
      UPDATE users SET email = ? WHERE id = ?
    `);
    
    stmt.run(newEmail, userId);
    return this.getProfile(userId);
  }
};