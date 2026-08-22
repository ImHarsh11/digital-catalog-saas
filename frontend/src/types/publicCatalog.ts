import type { ProductStatus } from './product';

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
}
