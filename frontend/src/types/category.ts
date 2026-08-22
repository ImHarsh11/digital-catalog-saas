export interface Category {
  id: number;
  shop_id: number;
  name: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
  product_count: number;
  created_at: string;
  updated_at: string;
}

export interface CategoryCreateInput {
  name: string;
  description?: string;
  display_order?: number;
}

export interface CategoryUpdateInput {
  name?: string;
  description?: string;
  display_order?: number;
  is_active?: boolean;
}
