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

// --- Phase 6 pilot analytics --------------------------------------------

export interface TopProductStat {
  product_id: number;
  name: string;
  primary_image_url: string | null;
  view_count: number;
}

export interface TopSearchTerm {
  term: string;
  count: number;
}

export interface TopCategoryStat {
  category_id: number;
  name: string;
  view_count: number;
}

export interface ShopAnalytics {
  shop_views_total: number;
  shop_views_last_7_days: number;
  product_views_total: number;
  product_views_last_7_days: number;
  searches_total: number;
  searches_last_7_days: number;
  top_products: TopProductStat[];
  top_searches: TopSearchTerm[];
  top_categories: TopCategoryStat[];
}
