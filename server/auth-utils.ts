// auth-utils.ts
import crypto from 'crypto';
import { IUser } from './types';

export const hashPassword = (password: string): string => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(password, salt, 1000, 64, 'sha512')
    .toString('hex');
  return `${salt}:${hash}`;
};

export const comparePasswords = (stored: string, supplied: string): boolean => {
  const [salt, hash] = stored.split(':');
  const suppliedHash = crypto
    .pbkdf2Sync(supplied, salt, 1000, 64, 'sha512')
    .toString('hex');
  return hash === suppliedHash;
};

export const sanitizeUser = (user: IUser): Omit<IUser, 'password'> => {
  const { password, ...safeUser } = user;
  return safeUser;
};