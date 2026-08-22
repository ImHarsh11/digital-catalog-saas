import { api } from './api';
import type { Category, CategoryCreateInput, CategoryUpdateInput } from '@/types/category';

export async function listCategories(shopId: number): Promise<Category[]> {
  const { data } = await api.get<Category[]>(`/api/shops/${shopId}/categories`);
  return data;
}

export async function createCategory(shopId: number, payload: CategoryCreateInput): Promise<Category> {
  const { data } = await api.post<Category>(`/api/shops/${shopId}/categories`, payload);
  return data;
}

export async function updateCategory(
  shopId: number,
  categoryId: number,
  payload: CategoryUpdateInput,
): Promise<Category> {
  const { data } = await api.put<Category>(`/api/shops/${shopId}/categories/${categoryId}`, payload);
  return data;
}

export async function deleteCategory(shopId: number, categoryId: number): Promise<void> {
  await api.delete(`/api/shops/${shopId}/categories/${categoryId}`);
}
