import type { SubscriptionStatus } from './shop';

export interface SuperAdminDashboardStats {
  total_shops: number;
  active_shops: number;
  trial_shops: number;
  expired_trials: number;
  total_products: number;
  products_added_this_week: number;
}

export interface ShopOwnerDashboardStats {
  product_count: number;
  products_available: number;
  products_sold: number;
  products_out_of_stock: number;
  products_added_this_week: number;
  is_active: boolean;
  subscription_status: SubscriptionStatus;
  trial_days_remaining: number;
  trial_status_label: string;
}
