import type { ShopListItem } from '@/types/shop';

type Tone = 'green' | 'amber' | 'red' | 'neutral' | 'blue';

export function shopStatusBadge(
  shop: Pick<ShopListItem, 'is_active' | 'subscription_status'>,
): { label: string; tone: Tone } {
  if (!shop.is_active) {
    return { label: 'Inactive', tone: 'neutral' };
  }
  switch (shop.subscription_status) {
    case 'TRIAL':
      return { label: 'Trial', tone: 'blue' };
    case 'ACTIVE':
      return { label: 'Active', tone: 'green' };
    case 'EXPIRED':
      return { label: 'Expired', tone: 'red' };
    case 'SUSPENDED':
      return { label: 'Suspended', tone: 'amber' };
    default:
      return { label: shop.subscription_status, tone: 'neutral' };
  }
}

export function trialBadgeTone(trialStatusLabel: string, trialDaysRemaining: number): Tone {
  if (trialStatusLabel === 'Trial expired') return 'red';
  if (trialDaysRemaining <= 3) return 'amber';
  return 'green';
}
