import { api } from './api';
import type { SuperAdminDashboardStats } from '@/types/dashboard';
import type { FontPairInfo, ThemeConfig, ThemePresetInfo } from '@/types/theme';
import type {
  BillingPlanInfo,
  InvoiceItem,
  ShopBillingDetail,
  ShopBillingUpdateInput,
  ShopCreateInput,
  ShopCreateResponse,
  ShopDetail,
  ShopDetailResponse,
  ShopListItem,
  ShopUpdateInput,
  SubscriptionActionResponse,
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

export async function listBillingPlans(): Promise<BillingPlanInfo[]> {
  const { data } = await api.get<BillingPlanInfo[]>('/api/super-admin/billing-plans');
  return data;
}

export async function createShopSubscription(
  shopId: number,
  planCode?: string,
): Promise<SubscriptionActionResponse> {
  const { data } = await api.post<SubscriptionActionResponse>(
    `/api/super-admin/shops/${shopId}/subscription`,
    null,
    { params: planCode ? { plan_code: planCode } : undefined },
  );
  return data;
}

export async function cancelShopSubscription(
  shopId: number,
  atPeriodEnd = true,
): Promise<ShopBillingDetail> {
  const { data } = await api.post<ShopBillingDetail>(
    `/api/super-admin/shops/${shopId}/subscription/cancel`,
    null,
    { params: { at_period_end: atPeriodEnd } },
  );
  return data;
}

export async function reconcileShopSubscription(shopId: number): Promise<ShopBillingDetail> {
  const { data } = await api.post<ShopBillingDetail>(
    `/api/super-admin/shops/${shopId}/subscription/reconcile`,
  );
  return data;
}

export async function listShopInvoices(shopId: number): Promise<InvoiceItem[]> {
  const { data } = await api.get<InvoiceItem[]>(`/api/super-admin/shops/${shopId}/invoices`);
  return data;
}

export async function listThemePresets(): Promise<ThemePresetInfo[]> {
  const { data } = await api.get<ThemePresetInfo[]>('/api/super-admin/theme-presets');
  return data;
}

export async function updateShopTheme(
  shopId: number,
  config: ThemeConfig,
): Promise<ShopDetailResponse> {
  const { data } = await api.put<ShopDetailResponse>(
    `/api/super-admin/shops/${shopId}/theme`,
    config,
  );
  return data;
}

export async function listFontPairs(): Promise<FontPairInfo[]> {
  const { data } = await api.get<FontPairInfo[]>('/api/super-admin/font-pairs');
  return data;
}

export async function uploadShopLogo(shopId: number, file: File): Promise<ShopDetailResponse> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post<ShopDetailResponse>(
    `/api/super-admin/shops/${shopId}/logo`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data;
}

export async function deleteShopLogo(shopId: number): Promise<ShopDetailResponse> {
  const { data } = await api.delete<ShopDetailResponse>(`/api/super-admin/shops/${shopId}/logo`);
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
