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

// --- Phase 6 pilot analytics (legacy flat) --------------------------------

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

// --- Phase 7 rich analytics ------------------------------------------------

export interface PeriodKPI {
  current: number;
  previous: number;
  change: number; // percentage, positive = growth
}

export interface TimeSeriesVisit {
  bucket: string; // ISO-8601
  visits: number;
  unique_visitors: number;
}

export interface TimeSeriesSale {
  bucket: string;
  sold: number;
}

export interface RichProductStat {
  product_id: number;
  name: string;
  primary_image_url: string | null;
  category_id: number | null;
  category_name: string | null;
  view_count: number;
}

export interface RichSoldProductStat {
  product_id: number;
  name: string;
  primary_image_url: string | null;
  category_id: number | null;
  category_name: string | null;
  sold_count: number;
}

export interface CategoryStat {
  category_id: number;
  name: string;
  views: number;
  unique_visitors: number;
  sold: number;
  sales_share: number;
}

export interface SearchInsight {
  term: string;
  count: number;
}

export interface RichAnalytics {
  period: string;
  date_range_start: string;
  date_range_end: string;
  visits: PeriodKPI;
  unique_visitors: PeriodKPI;
  product_views: PeriodKPI;
  products_sold: PeriodKPI;
  avg_visits_per_day: number;
  avg_unique_per_day: number;
  visits_series: TimeSeriesVisit[];
  sales_series: TimeSeriesSale[];
  top_viewed_products: RichProductStat[];
  top_sold_products: RichSoldProductStat[];
  category_stats: CategoryStat[];
  search_insights: SearchInsight[];
}
