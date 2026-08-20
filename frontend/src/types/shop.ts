import type { User } from './auth';

export type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'EXPIRED' | 'SUSPENDED';

export interface ShopBrief {
  id: number;
  name: string;
  slug: string;
  is_active: boolean;
  subscription_status: SubscriptionStatus;
  trial_end_date: string | null;
  trial_days_remaining: number;
  trial_status_label: string;
}

export interface ShopOwnerBrief {
  id: number;
  name: string;
  email: string;
}

export interface ShopListItem {
  id: number;
  name: string;
  slug: string;
  is_active: boolean;
  subscription_status: SubscriptionStatus;
  trial_end_date: string | null;
  trial_days_remaining: number;
  trial_status_label: string;
  owner: ShopOwnerBrief | null;
  product_count: number;
  created_at: string;
}

export interface ShopDetail extends ShopListItem {
  description: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  website: string | null;
  logo_url: string | null;
  updated_at: string;
  products_available: number;
  products_sold: number;
  products_out_of_stock: number;
  products_added_this_week: number;
}

export interface RecentActivityItem {
  id: number;
  action: string;
  product_id: number | null;
  product_name: string | null;
  user_id: number | null;
  user_name: string | null;
  created_at: string;
}

export interface ShopDetailResponse {
  shop: ShopDetail;
  recent_activity: RecentActivityItem[];
}

export interface ShopCreateInput {
  name: string;
  slug?: string;
  description?: string;
  phone?: string;
  address?: string;
  city?: string;
  website?: string;
  logo_url?: string;
  owner_name: string;
  owner_email: string;
  owner_password: string;
}

export interface ShopCreateResponse {
  shop: ShopDetail;
  owner: User;
}

export interface ShopUpdateInput {
  name?: string;
  description?: string;
  phone?: string;
  address?: string;
  city?: string;
  website?: string;
  logo_url?: string;
}
