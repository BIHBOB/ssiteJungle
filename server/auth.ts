import { Express, Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import session from 'express-session';
import { Database } from 'better-sqlite3';
import crypto from 'crypto';

interface IUser {
  id: number;
  username: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  isAdmin: boolean;
  }

declare global {
  namespace Express {
    interface User extends IUser {}
  }
}

interface IStorage {
  getUserByUsername(username: string): Promise<IUser | null>;
  getUserByEmail(email: string): Promise<IUser | null>;
  getUser(id: number): Promise<IUser | null>;
  createUser(userData: Omit<IUser, 'id'>): Promise<IUser>;
  comparePasswords(plain: string, hashed: string): Promise<boolean>;
  hashPassword(password: string): Promise<string>;
}

let storage: IStorage;

export function initAuth(db: Database) {
  storage = {
    async getUserByUsername(username: string): Promise<IUser | null> {
      const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
      return user ? mapDbUser(user) : null;
    },
    
    async getUserByEmail(email: string): Promise<IUser | null> {
      const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
      return user ? mapDbUser(user) : null;
    },
    
    async getUser(id: number): Promise<IUser | null> {
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
      return user ? mapDbUser(user) : null;
    },
    
    async createUser(userData: Omit<IUser, 'id'>): Promise<IUser> {
      const result = db.prepare(`
        INSERT INTO users (username, email, password, first_name, last_name, is_admin)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        userData.username,
        userData.email,
        await this.hashPassword(userData.password),
        userData.firstName,
        userData.lastName,
        userData.isAdmin ? 1 : 0
      );
      
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
      return mapDbUser(user);
    },
    
    async comparePasswords(plain: string, hashed: string): Promise<boolean> {
      const [salt, hash] = hashed.split(':');
      const suppliedHash = crypto
        .pbkdf2Sync(plain, salt, 1000, 64, 'sha512')
        .toString('hex');
      return hash === suppliedHash;
    },
    
    async hashPassword(password: string): Promise<string> {
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto
        .pbkdf2Sync(password, salt, 1000, 64, 'sha512')
        .toString('hex');
      return `${salt}:${hash}`;
    }
  };
  
  return {
    storage,
    comparePasswords: storage.comparePasswords,
    hashPassword: storage.hashPassword
  };
}

function mapDbUser(dbUser: any): IUser {
  return {
    id: dbUser.id,
    username: dbUser.username,
    email: dbUser.email,
    password: dbUser.password,
    firstName: dbUser.first_name,
    lastName: dbUser.last_name,
    isAdmin: dbUser.is_admin === 1
  };
}

export function setupAuth(app: Express) {
  if (!storage) {
    throw new Error('Auth storage not initialized. Call initAuth() first.');
  }

  // Настройка сессии
  app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 1 неделя
    }
  }));

  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(
      { usernameField: "username" },
      async (username: string, password: string, done) => {
        try {
          let user = await storage.getUserByUsername(username);
          if (!user) {
            user = await storage.getUserByEmail(username);
          }
          
          if (!user || !(await storage.comparePasswords(password, user.password))) {
            return done(null, false, { message: "Неверное имя пользователя или пароль" });
          }
          
          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  passport.serializeUser((user: IUser, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  // Роуты аутентификации
  app.post("/api/register", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { username, email, password } = req.body;

      if (await storage.getUserByUsername(username)) {
        return res.status(400).json({ message: "Имя пользователя уже занято" });
      }

      if (await storage.getUserByEmail(email)) {
        return res.status(400).json({ message: "Email уже зарегистрирован" });
      }

      const user = await storage.createUser({
        ...req.body,
        password,
        isAdmin: false
      });

      req.login(user, (err) => {
        if (err) return next(err);
        const { password, ...userWithoutPassword } = user;
        res.status(201).json(userWithoutPassword);
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/login", (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate("local", (err, user, info) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ message: info?.message || "Ошибка входа" });

      req.login(user, (err) => {
        if (err) return next(err);
        const { password, ...userWithoutPassword } = user;
        res.json(userWithoutPassword);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req: Request, res: Response, next: NextFunction) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Не авторизован" });
    }
    const { password, ...userWithoutPassword } = req.user as IUser;
    res.json(userWithoutPassword);
  });
}