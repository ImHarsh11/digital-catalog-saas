import { publicApi } from './publicApi';
import type { PublicProductDetail, PublicProductPage, PublicShopResponse } from '@/types/publicCatalog';

export type SortOption = 'newest' | 'price_asc' | 'price_desc';
export type AvailabilityFilter = 'available' | 'unavailable';

export interface PublicProductFilters {
  categoryId?: number;
  availability?: AvailabilityFilter;
  search?: string;
  sort?: SortOption;
  page?: number;
}

export async function getShopCatalog(shopSlug: string): Promise<PublicShopResponse> {
  const { data } = await publicApi.get<PublicShopResponse>(`/api/public/shops/${shopSlug}`);
  return data;
}

export async function listShopProducts(
  shopSlug: string,
  filters: PublicProductFilters = {},
): Promise<PublicProductPage> {
  const params: Record<string, string> = {};
  if (filters.categoryId) params.category_id = String(filters.categoryId);
  if (filters.availability) params.availability = filters.availability;
  if (filters.search) params.search = filters.search;
  if (filters.sort) params.sort = filters.sort;
  if (filters.page) params.page = String(filters.page);
  const { data } = await publicApi.get<PublicProductPage>(`/api/public/shops/${shopSlug}/products`, { params });
  return data;
}

export async function getShopProduct(shopSlug: string, productId: number): Promise<PublicProductDetail> {
  const { data } = await publicApi.get<PublicProductDetail>(`/api/public/shops/${shopSlug}/products/${productId}`);
  return data;
}
