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
    case 'PAST_DUE':
      return { label: 'Past due', tone: 'amber' };
    case 'EXPIRED':
      return { label: 'Expired', tone: 'red' };
    case 'SUSPENDED':
      return { label: 'Suspended', tone: 'amber' };
    case 'CANCELLED':
      return { label: 'Cancelled', tone: 'neutral' };
    default:
      return { label: shop.subscription_status, tone: 'neutral' };
  }
}

export function trialBadgeTone(trialStatusLabel: string, trialDaysRemaining: number): Tone {
  if (trialStatusLabel === 'Trial expired') return 'red';
  if (trialDaysRemaining <= 3) return 'amber';
  return 'green';
}

/** Tone for the lifecycle label shown next to a shop (trial countdown,
 *  "Active", "Suspended", ...). */
export function lifecycleTone(
  shop: Pick<ShopListItem, 'subscription_status' | 'trial_days_remaining' | 'trial_status_label'>,
): Tone {
  if (shop.trial_status_label === 'Trial expired' || shop.subscription_status === 'EXPIRED') {
    return 'red';
  }
  if (shop.subscription_status === 'SUSPENDED' || shop.subscription_status === 'PAST_DUE') {
    return 'amber';
  }
  if (shop.subscription_status === 'ACTIVE') return 'green';
  if (shop.subscription_status === 'TRIAL' && shop.trial_days_remaining <= 3) return 'amber';
  if (shop.subscription_status === 'CANCELLED') return 'neutral';
  return 'green';
}
