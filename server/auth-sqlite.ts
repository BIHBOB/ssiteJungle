import express, { type Express } from "express";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { db } from "./db-sqlite";
import crypto from "crypto";
import { z } from "zod";
import MemoryStore from "memorystore";
import { createServer, type Server } from "http";
import { randomBytes, pbkdf2Sync } from "crypto";

// Используем SQLite вместо Postgres
const Session = MemoryStore(session);

// Тип для записи пользователя в базе данных
export type UserRecord = {
  id: string;
  email: string;
  password: string;
  username: string | null;
  full_name: string | null;
  phone: string | null;
  address: string | null;
  is_admin: number;
  balance: string | null;
  created_at: string;
  updated_at: string;
};

// User type with normalized fields for the application
export type User = {
  id: string;
  email: string;
  fullName: string;
  isAdmin: boolean;
  balance: string;
  password: string;
  socialType: null;
  createdAt: Date | null;
  phone: string;
  address: string;
  username: string;
};

// Добавляем глобальный кэш админов
const adminCache = new Set<string>();

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(32).toString('hex');
  const iterations = 10000;
  const keylen = 64;
  const digest = 'sha512';
  const hash = crypto.pbkdf2Sync(password, salt, iterations, keylen, digest).toString('hex');
  return `${salt}:${iterations}:${keylen}:${digest}:${hash}`;
}

export function comparePasswords(storedPassword: string, suppliedPassword: string): boolean {
  try {
    const parts = storedPassword.split(':');
    if (parts.length !== 5) {
      console.error("[Auth] Неверный формат сохраненного пароля");
      return false;
    }
    
    const [salt, iterations, keylen, digest, storedHash] = parts;
    
    const suppliedHash = crypto
      .pbkdf2Sync(suppliedPassword, salt, parseInt(iterations), parseInt(keylen), digest)
      .toString('hex');
      
    // Используем timingSafeEqual для предотвращения атак по времени
    return crypto.timingSafeEqual(Buffer.from(storedHash, 'hex'), Buffer.from(suppliedHash, 'hex'));
  } catch (error) {
    console.error("[Auth] Ошибка при сравнении паролей:", error);
    return false;
  }
}

const registerSchema = z.object({
  email: z.string()
    .email("Введите корректный email")
    .min(5, "Email должен содержать минимум 5 символов")
    .max(100, "Email должен содержать максимум 100 символов")
    .transform(email => email.toLowerCase().trim()),
  password: z.string()
    .min(8, "Пароль должен быть минимум 8 символов")
    .max(100, "Пароль должен содержать максимум 100 символов")
    .regex(/[A-Z]/, "Пароль должен содержать хотя бы одну заглавную букву")
    .regex(/[0-9]/, "Пароль должен содержать хотя бы одну цифру"),
  fullName: z.string().min(3, "ФИО должно содержать не менее 3 символов"),
  phone: z.string().min(10, "Введите корректный номер телефона"),
  address: z.string().min(5, "Введите полный адрес"),
  username: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string()
    .email("Введите корректный email")
    .min(5, "Email должен содержать минимум 5 символов")
    .max(100, "Email должен содержать максимум 100 символов")
    .transform(email => email.toLowerCase().trim()),
  password: z.string()
    .min(1, "Введите пароль")
    .max(100, "Пароль должен содержать максимум 100 символов"),
});

// Расширяем интерфейс Express.User для TypeScript
declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      fullName: string;
      phone: string;
      address: string;
      username: string;
      isAdmin: boolean;
      balance: string;
      [key: string]: any;
    }
  }
}

// Функция преобразования из записи БД в пользовательский объект для сессии
export function userRecordToSessionUser(dbUser: UserRecord): Express.User {
  return {
    id: dbUser.id,
    email: dbUser.email,
    fullName: dbUser.full_name || '',
    phone: dbUser.phone || '',
    address: dbUser.address || '',
    username: dbUser.username || dbUser.email,
    isAdmin: dbUser.is_admin === 1,
    balance: dbUser.balance || '0',
    password: '',
    socialType: null,
    createdAt: dbUser.created_at ? new Date(dbUser.created_at) : null,
  };
}

// Настройка аутентификации для Express-приложения
export function setupAuth(app: Express) {
  // Настройка сессии
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "keyboard cat",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        maxAge: 1000 * 60 * 60 * 24, // 1 day
      },
      store: new Session({
        checkPeriod: 86400000, // Clear expired sessions every 24h
      }),
    }),
  );

  // Инициализация Passport
  app.use(passport.initialize());
  app.use(passport.session());

  // Настройка сериализации пользователя для паспорта
  passport.serializeUser((user: any, done) => {
    console.log(`[Auth] Сериализация пользователя ${user.email}`);
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const dbUser = db.queryOne("SELECT * FROM users WHERE id = ?", [id]) as UserRecord | null;
      
      if (!dbUser) {
        console.log(`[Auth] Пользователь с ID ${id} не найден при десериализации`);
        return done(null, null);
      }
      
      const user = userRecordToSessionUser(dbUser);
      console.log(`[Auth] Десериализация пользователя ${user.email}, админ: ${user.isAdmin ? "Да" : "Нет"}`);
      done(null, user);
    } catch (error) {
      console.error("[Auth] Ошибка десериализации:", error);
      done(error, null);
    }
  });

  // Настройка локальной стратегии
  passport.use(new LocalStrategy(
    { usernameField: "email", passwordField: "password" },
      async (email, password, done) => {
        try {
        // Ищем пользователя
        const user = db.queryOne(
          "SELECT * FROM users WHERE email = ?",
          [email.toLowerCase()]
        ) as UserRecord | null;

          if (!user) {
          console.log(`[Auth] Пользователь с email ${email} не найден`);
          return done(null, false);
          }

          // Проверяем пароль
        const isValidPassword = comparePasswords(user.password, password);
        
        if (!isValidPassword) {
          console.log(`[Auth] Неверный пароль для пользователя ${email}`);
          return done(null, false);
        }
        
        console.log(`[Auth] Успешная аутентификация пользователя ${email}`);
        
        // Форматируем пользователя для хранения в сессии
        const sessionUser = userRecordToSessionUser(user);
        
        return done(null, sessionUser);
        } catch (error) {
          return done(error);
        }
    }
  ));

  // Маршруты для аутентификации
  app.post("/api/auth/register", async (req, res) => {
    try {
      // Валидация с преобразованием данных по новой схеме
      const validatedData = registerSchema.parse(req.body);
      const { email, password, fullName, phone, address, username } = validatedData;

      // Проверка существующего пользователя
      const existingUser = db.queryOne("SELECT * FROM users WHERE email = ?", [email]);
      if (existingUser) {
        return res.status(400).json({ 
          message: "Пользователь с таким email уже существует",
          field: "email"
        });
      }

      // Создание пользователя
      const userId = crypto.randomUUID();
      db.run(
        `INSERT INTO users (
          id, email, password, username, full_name, phone, address, is_admin, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          email.toLowerCase(),
          hashPassword(password),
          username || email.split('@')[0], // Используем username, если есть, иначе email
          fullName,
          phone,
          address,
          0, // is_admin
          new Date().toISOString()
        ]
      );

      // Получение созданного пользователя
      const newUser = db.queryOne("SELECT * FROM users WHERE id = ?", [userId]) as UserRecord;
      if (!newUser) {
        throw new Error("Ошибка при создании пользователя после вставки");
      }

      // Форматирование пользователя для сессии и ответа
      const user = userRecordToSessionUser(newUser);

      // Аутентификация (автоматический вход после регистрации)
      req.login(user, (err) => {
        if (err) {
          console.error("Ошибка аутентификации после регистрации:", err);
          // Несмотря на ошибку входа, регистрация успешна. Можно вернуть пользователя.
          return res.status(201).json({
            message: "Регистрация успешна (ошибка авто-входа)",
            user: {
              id: user.id,
              email: user.email,
              fullName: user.fullName,
              isAdmin: user.isAdmin,
              username: user.username,
              phone: user.phone,
              address: user.address,
              balance: user.balance
            },
          });
        }
        // Успешная регистрация и вход
        return res.status(201).json({
          message: "Регистрация успешна",
          user: {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            isAdmin: user.isAdmin,
            username: user.username,
            phone: user.phone,
            address: user.address,
            balance: user.balance
          },
        });
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Ошибка валидации регистрации:", error.errors);
        return res.status(400).json({
          message: "Ошибка валидации",
          errors: error.errors.map(err => ({
            path: err.path.join('.'),
            message: err.message
          }))
        });
      }
      console.error("Ошибка регистрации:", error);
      return res.status(500).json({ 
        message: "Внутренняя ошибка сервера при регистрации",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.post("/api/auth/login", (req, res, next) => {
    try {
      // Предварительная валидация
      loginSchema.parse(req.body);
      
      passport.authenticate("local", (err: any, user: Express.User, info: any) => {
        if (err) {
          console.error("Ошибка аутентификации:", err);
          return res.status(500).json({ 
            message: "Ошибка авторизации" 
          });
        }

        if (!user) {
          return res.status(401).json({ 
            message: "Неверный email или пароль",
            field: info?.field || "credentials"
          });
        }

        req.login(user, (err) => {
          if (err) {
            console.error("Ошибка входа:", err);
            return res.status(500).json({ 
              message: "Ошибка при входе в систему" 
            });
          }

          // Обновление данных пользователя
          const userRecord = db.queryOne("SELECT * FROM users WHERE id = ?", [user.id]) as UserRecord;
          const fullUser = userRecordToSessionUser(userRecord);
          Object.assign(user, fullUser);
          
          return res.json({ 
            message: "Вход выполнен успешно", 
            user: {
              id: fullUser.id,
              email: fullUser.email,
              firstName: fullUser.firstName,
              lastName: fullUser.lastName,
              isAdmin: fullUser.isAdmin,
              balance: fullUser.balance
            }
          });
        });
      })(req, res, next);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Ошибка валидации",
          errors: error.errors.map(err => ({
            path: err.path.join('.'),
            message: err.message
          }))
        });
      }
      console.error("Ошибка входа:", error);
      return res.status(500).json({ 
        message: "Внутренняя ошибка сервера" 
      });
    }
  });

  app.get("/api/auth/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Не авторизован" });
    }
    
    const user = req.user as Express.User;

    if (!user) {
      console.error("[Auth] req.user не определен после isAuthenticated()");
      return res.status(500).json({ message: "Не удалось получить данные пользователя (в сессии)" });
    }

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        address: user.address,
        username: user.username,
        isAdmin: user.isAdmin,
        balance: user.balance
      },
    });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: "Ошибка при выходе из системы" });
      }
      res.json({ message: "Успешный выход" });
    });
  });
}

// После setupAuth, добавляем функцию updateUserSession
export function updateUserSession(req: express.Request) {
  if (req.isAuthenticated() && req.user) {
    const user = req.user as Express.User;
    
    try {
      // Получаем актуальные данные пользователя из БД
      const dbUser = db.queryOne("SELECT * FROM users WHERE id = ?", [user.id]) as UserRecord | null;
      
      if (dbUser) {
        // Сохраняем текущие значения для логирования
        const prevBalance = user.balance;
        const prevIsAdmin = user.isAdmin;
        
        // Полностью обновляем объект пользователя из БД
        const updatedUser = userRecordToSessionUser(dbUser);
        
        // Копируем все поля из обновленного пользователя
        Object.assign(user, {
          id: updatedUser.id,
          email: updatedUser.email,
          fullName: updatedUser.fullName,
          phone: updatedUser.phone,
          address: updatedUser.address,
          username: updatedUser.username,
          isAdmin: updatedUser.isAdmin,
          balance: updatedUser.balance,
          socialType: updatedUser.socialType,
          createdAt: updatedUser.createdAt
        });
        
        // Логируем изменения
        if (prevBalance !== user.balance) {
          console.log(`Баланс пользователя ${user.id} обновлен: ${prevBalance} → ${user.balance}`);
        }
        if (prevIsAdmin !== user.isAdmin) {
          console.log(`Статус администратора пользователя ${user.id} обновлен: ${prevIsAdmin} → ${user.isAdmin}`);
        }
        
        console.log(`Сессия пользователя ${user.email} полностью обновлена. Админ: ${user.isAdmin}, Баланс: ${user.balance}`);
        
        // Принудительно сохраняем сессию
        return new Promise<void>((resolve, reject) => {
          req.session.save((err) => {
            if (err) {
              console.error("Ошибка при сохранении сессии:", err);
              reject(err);
            } else {
              console.log("Сессия успешно сохранена для пользователя:", user.email);
              resolve();
            }
          });
        });
      }
    } catch (error) {
      console.error("Ошибка при обновлении сессии пользователя:", error);
      throw error;
    }
  }
  return Promise.resolve();
}

// После setupAuth, добавляем функцию registerUser
export async function registerUser(userData: {
  email: string;
  password: string;
  username?: string;
  fullName?: string;
  phone?: string;
  address?: string;
}): Promise<any> {
  try {
    if (!userData.email) throw new Error('Email обязателен');
    const emailExists = db.queryOne(
      "SELECT * FROM users WHERE email = ?",
      [userData.email.toLowerCase()]
    );
    if (emailExists) throw new Error('Пользователь с таким email уже существует');
    const hashedPassword = hashPassword(userData.password);
    const userId = crypto.randomUUID();
    db.run(
      `INSERT INTO users (
        id, email, password, username, full_name, phone, address, balance, is_admin, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        userData.email.toLowerCase(),
        hashedPassword,
        userData.username || userData.email.split('@')[0],
        userData.fullName || '',
        userData.phone || '',
        userData.address || '',
        '0.00',
        0,
        new Date().toISOString()
      ]
    );
    const newUser = db.queryOne("SELECT * FROM users WHERE id = ?", [userId]) as UserRecord;
    if (!newUser) throw new Error('Ошибка при создании пользователя');
    const formattedUser = userRecordToSessionUser(newUser) as User;
    console.log(`Успешно зарегистрирован пользователь: ${userData.email}`);
    return formattedUser;
  } catch (error) {
    console.error('Ошибка регистрации пользователя:', error);
    throw error;
  }
}

// SQL для создания таблицы пользователей
const CREATE_USERS_TABLE = `
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
)`;

// Функция инициализации базы данных
export async function initializeDatabase() {
  try {
    // Создаем таблицу пользователей, если не существует
    db.run(CREATE_USERS_TABLE);

    // Проверяем существование колонки full_name (логика миграции)
    const tableInfo = db.query("PRAGMA table_info(users)");
    const hasFullName = tableInfo.some((col: any) => col.name === 'full_name');
    const hasFirstName = tableInfo.some((col: any) => col.name === 'first_name');
    const hasLastName = tableInfo.some((col: any) => col.name === 'last_name');
    
    if (!hasFullName && (hasFirstName || hasLastName)) {
      // Добавляем full_name
      db.run("ALTER TABLE users ADD COLUMN full_name TEXT;");
      // Переносим данные
      db.run("UPDATE users SET full_name = TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')) WHERE full_name IS NULL;");
      // Создаем новую таблицу без first_name/last_name
      db.run(`CREATE TABLE users_new (
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
      );`);
      db.run(`INSERT INTO users_new (id, email, password, username, full_name, phone, address, is_admin, balance, created_at, updated_at)
        SELECT id, email, password, username, full_name, phone, address, is_admin, balance, created_at, updated_at FROM users;`);
      db.run("DROP TABLE users;");
      db.run("ALTER TABLE users_new RENAME TO users;");
    }

    // Проверяем существование админа
    const adminEmail = "fortnite08qwer@gmail.com";
    const existingAdmin = db.queryOne("SELECT * FROM users WHERE email = ?", [adminEmail]);

    if (!existingAdmin) {
        console.log('Создание пользователя-администратора...');
        const adminPassword = "Plmokn09";
        const adminUsername = "admin";
        const adminFullName = "Admin User";
        const adminPhone = "";
        const adminAddress = "";
        const adminBalance = '0.00';
        const now = new Date().toISOString();
        const userId = crypto.randomUUID();
        const hashedPassword = hashPassword(adminPassword);

        db.run(
            `INSERT INTO users (
                id, email, password, username, full_name, phone, address, is_admin, balance, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                userId,
                adminEmail,
                hashedPassword,
                adminUsername,
                adminFullName,
                adminPhone,
                adminAddress,
                1, // is_admin = 1
                adminBalance,
                now,
                now
            ]
        );
        console.log('Администратор успешно создан:');
        console.log(`Email: ${adminEmail}`);
        console.log(`Пароль: ${adminPassword}`);
    } else {
        console.log(`Администратор с email ${adminEmail} уже существует.`);
    }

    console.log('SQLite database initialized');
  } catch (error) {
    console.error('Error initializing SQLite database:', error);
    throw error;
  }
} 