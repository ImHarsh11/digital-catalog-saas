import { ArrowRight, Sparkles, Tag, TrendingUp } from 'lucide-react';
import type { PublicPromo, PromoKind } from '@/types/publicCatalog';

const KIND_STYLE: Record<
  PromoKind,
  { icon: typeof Tag; gradient: string }
> = {
  on_sale: {
    icon: Tag,
    gradient:
      'linear-gradient(135deg, var(--catalog-primary) 0%, color-mix(in srgb, var(--catalog-accent) 70%, var(--catalog-primary)) 100%)',
  },
  new_arrivals: {
    icon: Sparkles,
    gradient:
      'linear-gradient(135deg, color-mix(in srgb, var(--catalog-primary) 82%, #000) 0%, var(--catalog-accent) 130%)',
  },
  new_collection: {
    icon: TrendingUp,
    gradient:
      'linear-gradient(135deg, var(--catalog-accent) 0%, var(--catalog-primary) 100%)',
  },
};

/**
 * Auto-generated storefront promo banners (Discounts / New Arrivals / New
 * Collection). Content comes straight from catalog state — the shop owner
 * sets nothing up. Tapping a banner filters the grid; the active one is
 * highlighted. Horizontally scroll-snapped, theme-coloured.
 */
export default function PromoCarousel({
  promos,
  activeKey,
  onSelect,
}: {
  promos: PublicPromo[];
  activeKey: string | null;
  onSelect: (promo: PublicPromo | null) => void;
}) {
  if (promos.length === 0) return null;

  return (
    <div className="-mx-4 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {promos.map((promo) => {
        const { icon: Icon, gradient } = KIND_STYLE[promo.kind] ?? KIND_STYLE.new_collection;
        const active = activeKey === promo.key;
        return (
          <button
            key={promo.key}
            type="button"
            onClick={() => onSelect(active ? null : promo)}
            className={`relative flex min-w-[15rem] shrink-0 snap-start flex-col justify-between overflow-hidden rounded-2xl p-4 text-left text-white shadow-sm transition-transform active:scale-[0.98] ${
              active ? 'ring-2 ring-white/80 ring-offset-2 ring-offset-[var(--catalog-bg)]' : ''
            }`}
            style={{ background: gradient, minHeight: '7rem' }}
          >
            <Icon className="h-5 w-5 opacity-90" />
            <div>
              <p
                className="text-lg font-bold leading-tight"
                style={{ fontFamily: 'var(--catalog-heading-font)' }}
              >
                {promo.title}
              </p>
              <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-white/85">
                {active ? 'Showing these' : promo.subtitle}
                <ArrowRight className="h-3 w-3" />
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
