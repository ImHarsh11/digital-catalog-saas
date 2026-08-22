import type { ProductStatus } from '@/types/product';

// Customer-facing wording is deliberately different from the shop-owner
// admin labels in `utils/productStatus.ts` (spec: AVAILABLE -> "Available",
// SOLD -> "Sold Out", OUT_OF_STOCK -> "Currently unavailable"). Kept as its
// own module rather than reusing the admin one so the two audiences' copy
// can evolve independently.
type Tone = 'green' | 'neutral' | 'amber';

export function customerStatusBadge(status: ProductStatus): { label: string; tone: Tone } {
  switch (status) {
    case 'AVAILABLE':
      return { label: 'Available', tone: 'green' };
    case 'SOLD':
      return { label: 'Sold Out', tone: 'neutral' };
    case 'OUT_OF_STOCK':
      return { label: 'Currently unavailable', tone: 'amber' };
    default:
      return { label: status, tone: 'neutral' };
  }
}

export function isProductUnavailable(status: ProductStatus): boolean {
  return status !== 'AVAILABLE';
}
