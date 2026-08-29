import { Check, Plus } from 'lucide-react';
import { useSelection } from '@/hooks/useSelection';

/**
 * "＋ Add to My Choice" toggle. Adds/removes the product from the customer's
 * device-keyed shortlist. Theme-driven — uses the catalog CSS vars so it
 * re-colours per shop. `card` is the compact pill on a product card; `full`
 * is the wide sticky CTA on the product detail page.
 */
export default function SelectionButton({
  slug,
  productId,
  variant = 'card',
  disabled = false,
}: {
  slug: string;
  productId: number;
  variant?: 'card' | 'full';
  disabled?: boolean;
}) {
  const { has, toggle, pending } = useSelection(slug);
  const inList = has(productId);

  if (variant === 'full') {
    return (
      <button
        type="button"
        onClick={() => toggle(productId)}
        disabled={disabled || pending}
        aria-pressed={inList}
        className="flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold shadow-sm transition-all active:scale-[0.98] disabled:opacity-50"
        style={
          inList
            ? {
                background: 'var(--catalog-accent-soft)',
                color: 'var(--catalog-primary)',
                border: '1px solid var(--catalog-hairline)',
              }
            : {
                background:
                  'linear-gradient(135deg, var(--catalog-primary), var(--catalog-accent))',
                color: '#fff',
              }
        }
      >
        {inList ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        {inList ? 'In My Choice' : 'Add to My Choice'}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(productId);
      }}
      disabled={disabled || pending}
      aria-pressed={inList}
      aria-label={inList ? 'Remove from My Choice' : 'Add to My Choice'}
      className="flex items-center justify-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-all active:scale-95 disabled:opacity-50"
      style={
        inList
          ? {
              background: 'var(--catalog-accent-soft)',
              color: 'var(--catalog-primary)',
              border: '1px solid var(--catalog-hairline)',
            }
          : {
              background: 'var(--catalog-card)',
              color: 'var(--catalog-primary)',
              border: '1px solid var(--catalog-hairline)',
            }
      }
    >
      {inList ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
      {inList ? 'Added' : 'Add'}
    </button>
  );
}
