import { createContext } from 'react';
import type { User } from '@/types/auth';
import type { ShopBrief } from '@/types/shop';

export interface AuthContextValue {
  user: User | null;
  shop: ShopBrief | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
