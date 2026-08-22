import { api } from './api';
import type { ShopOwnerDashboardStats } from '@/types/dashboard';
import type { ShopDetail, ShopUpdateInput } from '@/types/shop';

export async function getShopOwnerDashboard(shopId: number): Promise<ShopOwnerDashboardStats> {
  const { data } = await api.get<ShopOwnerDashboardStats>(`/api/shops/${shopId}/dashboard`);
  return data;
}

export async function getShopProfile(shopId: number): Promise<ShopDetail> {
  const { data } = await api.get<ShopDetail>(`/api/shops/${shopId}/profile`);
  return data;
}

export async function updateShopProfile(shopId: number, payload: ShopUpdateInput): Promise<ShopDetail> {
  const { data } = await api.put<ShopDetail>(`/api/shops/${shopId}/profile`, payload);
  return data;
}
