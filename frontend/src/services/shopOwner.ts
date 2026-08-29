import { api } from './api';
import type { Lead, RichAnalytics, ShopAnalytics, ShopOwnerDashboardStats } from '@/types/dashboard';
import type {
  InvoiceItem,
  ShopBillingDetail,
  ShopDetail,
  ShopUpdateInput,
  SubscriptionActionResponse,
} from '@/types/shop';

export async function getOwnerBilling(shopId: number): Promise<ShopBillingDetail> {
  const { data } = await api.get<ShopBillingDetail>(`/api/shops/${shopId}/billing`);
  return data;
}

export async function startOwnerSubscription(shopId: number): Promise<SubscriptionActionResponse> {
  const { data } = await api.post<SubscriptionActionResponse>(
    `/api/shops/${shopId}/billing/subscription`,
  );
  return data;
}

export async function getOwnerInvoices(shopId: number): Promise<InvoiceItem[]> {
  const { data } = await api.get<InvoiceItem[]>(`/api/shops/${shopId}/invoices`);
  return data;
}

export async function getShopOwnerDashboard(shopId: number): Promise<ShopOwnerDashboardStats> {
  const { data } = await api.get<ShopOwnerDashboardStats>(`/api/shops/${shopId}/dashboard`);
  return data;
}

export async function getShopAnalytics(shopId: number): Promise<ShopAnalytics> {
  const { data } = await api.get<ShopAnalytics>(`/api/shops/${shopId}/analytics`);
  return data;
}

export async function getRichAnalytics(shopId: number, period: string): Promise<RichAnalytics> {
  const { data } = await api.get<RichAnalytics>(`/api/shops/${shopId}/analytics/rich`, {
    params: { period },
  });
  return data;
}

export async function getLeads(shopId: number): Promise<Lead[]> {
  const { data } = await api.get<Lead[]>(`/api/shops/${shopId}/leads`);
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
