import { publicApi } from './publicApi';
import type {
  CustomerContactInput,
  CustomerContactResponse,
  ProductLikeResponse,
  PublicProductDetail,
  PublicProductPage,
  PublicSelection,
  PublicShopResponse,
} from '@/types/publicCatalog';

export type SortOption = 'newest' | 'price_asc' | 'price_desc';
export type AvailabilityFilter = 'available' | 'unavailable';

export interface PublicProductFilters {
  categoryId?: number;
  availability?: AvailabilityFilter;
  search?: string;
  sort?: SortOption;
  page?: number;
  pageSize?: number;
  color?: string;
  brand?: string;
  priceMin?: number;
  priceMax?: number;
  discounted?: boolean;
  newWithinDays?: number;
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
  if (filters.pageSize) params.page_size = String(filters.pageSize);
  if (filters.color) params.color = filters.color;
  if (filters.brand) params.brand = filters.brand;
  if (filters.priceMin !== undefined) params.price_min = String(filters.priceMin);
  if (filters.priceMax !== undefined) params.price_max = String(filters.priceMax);
  if (filters.discounted) params.discounted = 'true';
  if (filters.newWithinDays !== undefined) params.new_within_days = String(filters.newWithinDays);
  const { data } = await publicApi.get<PublicProductPage>(`/api/public/shops/${shopSlug}/products`, { params });
  return data;
}

export async function getShopProduct(shopSlug: string, productId: number): Promise<PublicProductDetail> {
  const { data } = await publicApi.get<PublicProductDetail>(`/api/public/shops/${shopSlug}/products/${productId}`);
  return data;
}

export async function submitCustomerContact(
  shopSlug: string,
  contact: CustomerContactInput,
): Promise<CustomerContactResponse> {
  const { data } = await publicApi.post<CustomerContactResponse>(
    `/api/public/shops/${shopSlug}/contacts`,
    contact,
  );
  return data;
}

export async function toggleProductLike(
  shopSlug: string,
  productId: number,
): Promise<ProductLikeResponse> {
  const { data } = await publicApi.post<ProductLikeResponse>(
    `/api/public/shops/${shopSlug}/products/${productId}/like`,
  );
  return data;
}

export async function getProductLikeStatus(
  shopSlug: string,
  productId: number,
): Promise<ProductLikeResponse> {
  const { data } = await publicApi.get<ProductLikeResponse>(
    `/api/public/shops/${shopSlug}/products/${productId}/like`,
  );
  return data;
}

// ── Guest selection list ────────────────────────────────────────────────────

export async function getSelection(shopSlug: string): Promise<PublicSelection> {
  const { data } = await publicApi.get<PublicSelection>(`/api/public/shops/${shopSlug}/selection`);
  return data;
}

export async function addSelectionItem(
  shopSlug: string,
  productId: number,
  note?: string,
): Promise<PublicSelection> {
  const { data } = await publicApi.post<PublicSelection>(
    `/api/public/shops/${shopSlug}/selection/items`,
    { product_id: productId, note: note ?? null },
  );
  return data;
}

export async function removeSelectionItem(
  shopSlug: string,
  productId: number,
): Promise<PublicSelection> {
  const { data } = await publicApi.delete<PublicSelection>(
    `/api/public/shops/${shopSlug}/selection/items/${productId}`,
  );
  return data;
}

export async function updateSelectionNote(
  shopSlug: string,
  productId: number,
  note: string,
): Promise<PublicSelection> {
  const { data } = await publicApi.patch<PublicSelection>(
    `/api/public/shops/${shopSlug}/selection/items/${productId}`,
    { note },
  );
  return data;
}
