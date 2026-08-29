import { api } from './api';
import type { SuperAdminDashboardStats } from '@/types/dashboard';
import type {
  ShopBillingDetail,
  ShopBillingUpdateInput,
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

export async function updateShopBilling(
  shopId: number,
  payload: ShopBillingUpdateInput,
): Promise<ShopBillingDetail> {
  const { data } = await api.patch<ShopBillingDetail>(
    `/api/super-admin/shops/${shopId}/billing`,
    payload,
  );
  return data;
}

// Fetched as a blob (rather than pointed at directly with an <img src>)
// because the endpoint requires the Super Admin's Authorization header --
// a plain <img>/<a> tag can't attach one. The resulting blob: URL then
// works for both an inline preview and a same-origin download link.
export async function getShopQrCode(shopId: number): Promise<Blob> {
  const { data } = await api.get<Blob>(`/api/super-admin/shops/${shopId}/qr-code`, {
    responseType: 'blob',
  });
  return data;
}
