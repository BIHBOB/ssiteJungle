// types.ts
export interface IUser {
  id: string;
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