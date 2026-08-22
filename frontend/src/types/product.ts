import type { UserRole } from './auth';

export type ProductStatus = 'AVAILABLE' | 'SOLD' | 'OUT_OF_STOCK';

export interface ProductCategoryBrief {
  id: number;
  name: string;
}

export interface ProductCreatorBrief {
  id: number;
  name: string;
  role: UserRole;
}

export interface ProductImage {
  id: number;
  image_url: string;
  display_order: number;
  created_at: string;
}

export interface ProductListItem {
  id: number;
  shop_id: number;
  name: string;
  product_code: string | null;
  category: ProductCategoryBrief;
  price: number;
  status: ProductStatus;
  primary_image_url: string | null;
  image_count: number;
  created_by: ProductCreatorBrief | null;
  created_at: string;
  quantity_available: number;
  discount_percent: number | null;
}

export interface ProductDetail extends ProductListItem {
  description: string | null;
  images: ProductImage[];
  updated_at: string;
}

export interface ProductCreateInput {
  name: string;
  product_code?: string;
  category_id: number;
  price: number;
  description?: string;
  status?: ProductStatus;
  quantity_available?: number;
  discount_percent?: number | null;
}

export interface ProductUpdateInput {
  name?: string;
  product_code?: string;
  category_id?: number;
  price?: number;
  description?: string;
  quantity_available?: number;
  discount_percent?: number | null;
}

export interface ProductImageUploadResponse {
  image: ProductImage;
  primary_image_url: string | null;
}
