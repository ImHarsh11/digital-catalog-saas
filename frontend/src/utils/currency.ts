const formatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export function formatPrice(price: number): string {
  return formatter.format(price);
}

/** The price a customer actually pays, after any discount. Always use this
 *  (not the raw `price`) wherever a single figure is shown for a product —
 *  the catalog card, the product page, My Choice, and the owner's Leads. */
export function effectivePrice(price: number, discountPercent: number | null | undefined): number {
  if (!discountPercent || discountPercent <= 0) return price;
  return price * (1 - discountPercent / 100);
}
