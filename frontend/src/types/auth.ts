import type { ShopBrief } from './shop';

export type UserRole = 'SUPER_ADMIN' | 'SHOP_OWNER';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  shop_id: number | null;
  is_active: boolean;
  created_at: string;
}

export interface MeResponse {
  user: User;
  shop: ShopBrief | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}
