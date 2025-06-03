export type User = {
  id: number;
  username: string;
  email: string;
  password: string;
  fullName: string;
  phone: string;
  address: string;
  socialType: string | null;
  isAdmin: boolean;
  balance: string;
  createdAt: Date;
}; 