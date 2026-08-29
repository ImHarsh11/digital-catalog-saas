import type { ProductStatus } from './product';
import type { ResolvedTheme } from './theme';

export interface PublicCategory {
  id: number;
  name: string;
}

export interface PublicShop {
  id: number;
  name: string;
  slug: string;
  logo_url: string | null;
  description: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  website: string | null;
}

export interface PublicShopResponse {
  shop: PublicShop;
  categories: PublicCategory[];
  theme: ResolvedTheme;
}

export interface PublicProductImage {
  id: number;
  image_url: string;
  display_order: number;
}

export interface PublicProductListItem {
  id: number;
  name: string;
  product_code: string | null;
  category: PublicCategory;
  price: number;
  status: ProductStatus;
  primary_image_url: string | null;
  quantity_available: number;
  discount_percent: number | null;
  color: string | null;
  brand: string | null;
}

export interface PublicProductDetail extends PublicProductListItem {
  description: string | null;
  images: PublicProductImage[];
}

export interface PublicProductPage {
  items: PublicProductListItem[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
  suggestions: PublicProductListItem[] | null;
}

export interface CustomerContactInput {
  name?: string;
  whatsapp?: string;
  email?: string;
  consent_processing: boolean;
  consent_marketing: boolean;
}

export interface CustomerContactResponse {
  id: number;
  name: string | null;
  whatsapp: string | null;
  email: string | null;
  consent_marketing: boolean;
}

export interface PublicSelectionItem {
  product: PublicProductListItem;
  note: string | null;
  added_at: string;
}

export interface PublicSelection {
  items: PublicSelectionItem[];
  count: number;
  contact_captured: boolean;
}

export interface ProductLikeResponse {
  product_id: number;
  liked: boolean;
  like_count: number;
}
