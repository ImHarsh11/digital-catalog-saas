import type { ProductStatus } from '@/types/product';

type Tone = 'green' | 'amber' | 'red' | 'neutral' | 'blue';

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  AVAILABLE: 'Available',
  SOLD: 'Sold',
  OUT_OF_STOCK: 'Out of Stock',
};

export function productStatusBadge(status: ProductStatus): { label: string; tone: Tone } {
  switch (status) {
    case 'AVAILABLE':
      return { label: 'Available', tone: 'green' };
    case 'SOLD':
      return { label: 'Sold', tone: 'neutral' };
    case 'OUT_OF_STOCK':
      return { label: 'Out of Stock', tone: 'amber' };
    default:
      return { label: status, tone: 'neutral' };
  }
}
