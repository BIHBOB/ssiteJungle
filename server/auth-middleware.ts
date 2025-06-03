import { Express, Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import session from 'express-session';
import { IUser } from './types';
import { db } from './db-sqlite';
import { comparePasswords, sanitizeUser } from './auth-utils';

export const setupAuth = (app: Express) => {
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

  // Стратегия аутентификации
  passport.use(new LocalStrategy(
    { usernameField: 'email' },
    async (email, password, done) => {
      try {
        const user = db.getUserByEmail(email.toLowerCase());
        if (!user || !comparePasswords(user.password, password)) {
          return done(null, false, { message: 'Неверный email или пароль' });
        }
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  ));

  passport.serializeUser((user: IUser, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = db.getUserById(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  // Роуты аутентификации
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { email, password, firstName, lastName } = req.body;

      if (db.getUserByEmail(email)) {
        return res.status(400).json({ error: 'Email уже зарегистрирован' });
      }

      const newUser = db.createUser({
        email,
        password,
        firstName,
        lastName,
        isAdmin: false
      });

      req.login(newUser, (err) => {
        if (err) return res.status(500).json({ error: 'Ошибка при входе' });
        res.status(201).json(sanitizeUser(newUser));
      });
    } catch (error) {
      res.status(500).json({ error: 'Ошибка регистрации' });
    }
  });

  app.post('/api/auth/login', (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ error: info.message });

      req.login(user, (err) => {
        if (err) return next(err);
        res.json(sanitizeUser(user));
      });
    })(req, res, next);
  });

  app.post('/api/auth/logout', (req, res) => {
    req.logout(() => {
      res.sendStatus(200);
    });
  });

  app.get('/api/auth/me', (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Не авторизован' });
    }
    res.json(sanitizeUser(req.user as IUser));
  });
};