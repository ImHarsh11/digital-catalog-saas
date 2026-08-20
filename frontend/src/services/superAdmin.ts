import { api } from './api';
import type { SuperAdminDashboardStats } from '@/types/dashboard';
import type {
  ShopCreateInput,
  ShopCreateResponse,
  ShopDetail,
  ShopDetailResponse,
  ShopListItem,
  ShopUpdateInput,
} from '@/types/shop';

export async function getDashboardStats(): Promise<SuperAdminDashboardStats> {
  const { data } = await api.get<SuperAdminDashboardStats>('/api/super-admin/dashboard');
  return data;
}

export async function listShops(): Promise<ShopListItem[]> {
  const { data } = await api.get<ShopListItem[]>('/api/super-admin/shops');
  return data;
}

export async function getShopDetail(shopId: number): Promise<ShopDetailResponse> {
  const { data } = await api.get<ShopDetailResponse>(`/api/super-admin/shops/${shopId}`);
  return data;
}

export async function createShop(payload: ShopCreateInput): Promise<ShopCreateResponse> {
  const { data } = await api.post<ShopCreateResponse>('/api/super-admin/shops', payload);
  return data;
}

export async function updateShop(shopId: number, payload: ShopUpdateInput): Promise<ShopDetail> {
  const { data } = await api.put<ShopDetail>(`/api/super-admin/shops/${shopId}`, payload);
  return data;
}

export async function setShopStatus(shopId: number, isActive: boolean): Promise<ShopDetail> {
  const { data } = await api.patch<ShopDetail>(`/api/super-admin/shops/${shopId}/status`, {
    is_active: isActive,
  });
  return data;
}
