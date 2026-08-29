import type { User } from './auth';
import type { ResolvedTheme, ThemeConfig } from './theme';

export type SubscriptionStatus =
  | 'TRIAL'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'EXPIRED'
  | 'SUSPENDED'
  | 'CANCELLED';

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
}

export interface ShopBillingDetail {
  status: SubscriptionStatus;
  trial_start_date: string | null;
  trial_end_date: string | null;
  paid_until: string | null;
  grace_until: string | null;
  days_remaining: number;
  lifecycle_label: string;
  is_catalog_live: boolean;
}

export interface ShopDetailResponse {
  shop: ShopDetail;
  billing: ShopBillingDetail;
  theme_config: ThemeConfig;
  theme_resolved: ResolvedTheme;
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
  trial_days?: number;
  theme_preset?: string;
  owner_name: string;
  owner_email: string;
  owner_password: string;
}

export interface ShopBillingUpdateInput {
  status?: SubscriptionStatus;
  trial_end_date?: string | null;
  paid_until?: string | null;
  grace_until?: string | null;
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
