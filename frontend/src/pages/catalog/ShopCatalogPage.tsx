import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Filter,
  Heart,
  Package,
  Phone,
  Search,
  Shield,
  Sparkles,
  Star,
  Eye,
} from 'lucide-react';
import {
  getShopCatalog,
  listShopProducts,
  toggleProductLike,
  type SortOption,
} from '@/services/publicCatalog';
import { effectivePrice, formatPrice } from '@/utils/currency';
import ProductImage from '@/components/catalog/ProductImage';
import Spinner from '@/components/Spinner';
import CatalogThemeProvider from '@/components/catalog/CatalogThemeProvider';
import SelectionButton from '@/components/catalog/SelectionButton';
import SelectionBar from '@/components/catalog/SelectionBar';
import CustomerContactSheet, { contactPromptDone } from '@/components/catalog/CustomerContactSheet';
import PromoCarousel from '@/components/catalog/PromoCarousel';
import CatalogUnavailablePage from './CatalogUnavailablePage';
import type { PublicProductListItem, PublicPromo } from '@/types/publicCatalog';

// ─── Utility helpers ──────────────────────────────────────────────────────────

function shopInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

function discountedPrice(price: number, discountPercent: number | null): number | null {
  if (!discountPercent || discountPercent <= 0) return null;
  return effectivePrice(price, discountPercent);
}

// ─── Welcome / Splash screen ──────────────────────────────────────────────────

function WelcomeSplash({
  shopName,
  tagline,
  ornate,
  onEnter,
}: {
  shopName: string;
  tagline: string;
  ornate: boolean;
  onEnter: () => void;
}) {
  const initials = shopInitials(shopName);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{ background: 'var(--catalog-splash-grad)' }}
    >
      {ornate && (
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{ color: 'var(--catalog-accent)' }}
        >
          <svg className="absolute left-0 top-0 h-48 w-48 opacity-10" viewBox="0 0 200 200" fill="none">
            <circle cx="0" cy="0" r="180" stroke="currentColor" strokeWidth="1" />
            <circle cx="0" cy="0" r="150" stroke="currentColor" strokeWidth="0.5" />
            <circle cx="0" cy="0" r="120" stroke="currentColor" strokeWidth="0.5" />
          </svg>
          <svg className="absolute bottom-0 right-0 h-48 w-48 opacity-10" viewBox="0 0 200 200" fill="none">
            <circle cx="200" cy="200" r="180" stroke="currentColor" strokeWidth="1" />
            <circle cx="200" cy="200" r="150" stroke="currentColor" strokeWidth="0.5" />
            <circle cx="200" cy="200" r="120" stroke="currentColor" strokeWidth="0.5" />
          </svg>
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="absolute h-1 w-1 rounded-full opacity-20"
              style={{
                background: 'var(--catalog-accent)',
                left: `${(i * 37 + 10) % 95}%`,
                top: `${(i * 53 + 5) % 90}%`,
              }}
            />
          ))}
        </div>
      )}

      <div className="mb-10 flex items-center gap-3">
        <div className="h-px w-16 bg-gradient-to-r from-transparent to-yellow-400" />
        <Sparkles className="h-4 w-4 text-yellow-400" />
        <div className="h-px w-16 bg-gradient-to-l from-transparent to-yellow-400" />
      </div>

      <div
        className="mb-6 flex h-28 w-28 items-center justify-center rounded-full border-2 border-yellow-400/60 shadow-2xl"
        style={{
          background:
            'radial-gradient(circle at 35% 35%, var(--catalog-accent), color-mix(in srgb, var(--catalog-accent) 55%, #000))',
        }}
      >
        <span className="text-4xl font-bold tracking-widest text-white drop-shadow-lg">{initials}</span>
      </div>

      <h1
        className="px-8 text-center text-3xl font-bold uppercase tracking-[0.15em] text-white drop-shadow-md sm:text-4xl"
        style={{ fontFamily: 'var(--catalog-heading-font)' }}
      >
        {shopName}
      </h1>

      <p className="mt-3 text-center text-sm font-light tracking-widest text-yellow-300/80 uppercase">
        {tagline}
      </p>

      <div className="mt-10 flex items-center gap-3">
        <div className="h-px w-16 bg-gradient-to-r from-transparent to-yellow-400" />
        <Sparkles className="h-4 w-4 text-yellow-400" />
        <div className="h-px w-16 bg-gradient-to-l from-transparent to-yellow-400" />
      </div>

      <button
        type="button"
        onClick={onEnter}
        className="mt-14 rounded-full border border-yellow-400/60 bg-yellow-400/10 px-10 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-yellow-300 backdrop-blur-sm transition-all hover:bg-yellow-400/20 hover:text-yellow-200 active:scale-95"
      >
        Explore Collection
      </button>
    </div>
  );
}

// ─── Hero Banner Carousel ────────────────────────────────────────────────────

function HeroBanner({
  images,
  tagline,
}: {
  images: string[];
  tagline: string;
}) {
  const [active, setActive] = useState(0);
  const count = images.length;

  useEffect(() => {
    if (count <= 1) return;
    const id = setInterval(() => setActive((i) => (i + 1) % count), 5000);
    return () => clearInterval(id);
  }, [count]);

  const goTo = (idx: number) => setActive(idx);
  const prev = () => setActive((i) => (i - 1 + count) % count);
  const next = () => setActive((i) => (i + 1) % count);

  return (
    <div className="relative overflow-hidden" style={{ minHeight: '320px' }}>
      {/* Background: product image or gradient */}
      {count > 0 ? (
        <div className="absolute inset-0">
          {images.map((img, i) => (
            <div
              key={img}
              className="absolute inset-0 transition-opacity duration-700"
              style={{ opacity: i === active ? 1 : 0 }}
            >
              <img
                src={img}
                alt=""
                className="h-full w-full object-cover"
                loading={i === 0 ? 'eager' : 'lazy'}
              />
            </div>
          ))}
        </div>
      ) : (
        <div
          className="absolute inset-0"
          style={{ background: 'var(--catalog-header-grad)' }}
        />
      )}

      {/* Dark gradient overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: count > 0
            ? 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.35) 40%, rgba(0,0,0,0.2) 100%)'
            : 'linear-gradient(to top, rgba(0,0,0,0.3) 0%, transparent 100%)',
        }}
      />

      {/* Content */}
      <div className="relative flex min-h-[320px] flex-col items-center justify-end px-6 pb-10 pt-16 text-center sm:min-h-[400px] sm:pb-14">
        {/* Ornamental line */}
        <div className="mb-5 flex items-center gap-3">
          <div className="h-px w-10 sm:w-16" style={{ background: 'var(--catalog-accent)' }} />
          <Sparkles className="h-3.5 w-3.5" style={{ color: 'var(--catalog-accent)' }} />
          <div className="h-px w-10 sm:w-16" style={{ background: 'var(--catalog-accent)' }} />
        </div>

        <h2
          className="text-2xl font-bold leading-tight tracking-wide text-white drop-shadow-lg sm:text-4xl"
          style={{ fontFamily: 'var(--catalog-heading-font)' }}
        >
          {tagline}
        </h2>

        <p className="mt-2 text-sm text-white/70 sm:text-base">
          Explore our curated collection
        </p>

        <a
          href="#collections"
          className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-7 py-2.5 text-sm font-semibold uppercase tracking-wider text-white backdrop-blur-sm transition-all hover:bg-white/20 active:scale-95"
        >
          Explore Collection
          <ArrowRight className="h-4 w-4" />
        </a>

        {/* Dots */}
        {count > 1 && (
          <div className="mt-6 flex items-center gap-2">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goTo(i)}
                className={`h-2 rounded-full transition-all ${
                  i === active ? 'w-6' : 'w-2 hover:opacity-80'
                }`}
                style={{
                  background: i === active ? 'var(--catalog-accent)' : 'rgba(255,255,255,0.5)',
                }}
                aria-label={`Slide ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Prev / Next arrows (desktop) */}
      {count > 1 && (
        <>
          <button
            type="button"
            onClick={prev}
            className="absolute left-3 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full bg-black/30 p-2 text-white backdrop-blur-sm transition-all hover:bg-black/50 sm:flex"
            aria-label="Previous slide"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={next}
            className="absolute right-3 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full bg-black/30 p-2 text-white backdrop-blur-sm transition-all hover:bg-black/50 sm:flex"
            aria-label="Next slide"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}
    </div>
  );
}

// ─── Trust badges ────────────────────────────────────────────────────────────

const TRUST_ITEMS = [
  { icon: Star, label: 'Curated Collection' },
  { icon: Shield, label: 'Quality Assured' },
  { icon: Eye, label: 'Browse Anywhere' },
  { icon: Heart, label: 'Save Your Picks' },
];

function TrustBadges() {
  return (
    <div
      className="border-b px-4 py-4 sm:px-6"
      style={{ borderColor: 'var(--catalog-hairline)', background: 'var(--catalog-card)' }}
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 overflow-x-auto sm:justify-center sm:gap-10">
        {TRUST_ITEMS.map(({ icon: Icon, label }) => (
          <div key={label} className="flex shrink-0 flex-col items-center gap-1.5 sm:flex-row sm:gap-2">
            <Icon className="h-4 w-4 sm:h-5 sm:w-5" style={{ color: 'var(--catalog-accent)' }} />
            <span className="whitespace-nowrap text-[10px] font-medium sm:text-xs" style={{ color: 'var(--catalog-ink-muted)' }}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Ornamental section heading ──────────────────────────────────────────────

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-2 text-center">
      <div className="flex items-center gap-3">
        <div
          className="h-px w-8 sm:w-14"
          style={{ background: 'linear-gradient(to right, transparent, var(--catalog-accent))' }}
        />
        <Sparkles className="h-3 w-3" style={{ color: 'var(--catalog-accent)' }} />
        <div
          className="h-px w-8 sm:w-14"
          style={{ background: 'linear-gradient(to left, transparent, var(--catalog-accent))' }}
        />
      </div>
      <h2
        className="text-xl font-bold tracking-wide sm:text-2xl"
        style={{ color: 'var(--catalog-ink)', fontFamily: 'var(--catalog-heading-font)' }}
      >
        {title}
      </h2>
      {subtitle && (
        <p className="text-sm" style={{ color: 'var(--catalog-ink-muted)' }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

// ─── Collection card (category with image) ──────────────────────────────────

function CollectionCard({
  name,
  imageUrl,
  active,
  onClick,
}: {
  name: string;
  imageUrl: string | null;
  active: boolean;
  onClick: () => void;
}) {
  const initial = name[0]?.toUpperCase() ?? '?';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex flex-col overflow-hidden rounded-2xl shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] ${
        active ? 'ring-2 ring-offset-2' : ''
      }`}
      style={
        active
          ? {
              '--tw-ring-color': 'var(--catalog-accent)',
              '--tw-ring-offset-color': 'var(--catalog-bg)',
            } as React.CSSProperties
          : undefined
      }
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-neutral-100">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{
              background: `linear-gradient(135deg, var(--catalog-primary), color-mix(in srgb, var(--catalog-accent) 60%, var(--catalog-primary)))`,
            }}
          >
            <span className="text-3xl font-bold text-white/80">{initial}</span>
          </div>
        )}
        {/* Gradient overlay at bottom */}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent" />
      </div>
      <div className="absolute inset-x-0 bottom-0 p-3 text-left">
        <p
          className="text-sm font-semibold leading-tight text-white drop-shadow sm:text-base"
          style={{ fontFamily: 'var(--catalog-heading-font)' }}
        >
          {name}
        </p>
        <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-white/75">
          View Collection <ArrowRight className="h-3 w-3" />
        </p>
      </div>
    </button>
  );
}

// ─── Price display with optional discount ────────────────────────────────────

function PriceDisplay({
  price,
  discountPercent,
  large = false,
}: {
  price: number;
  discountPercent: number | null;
  large?: boolean;
}) {
  const final = discountedPrice(price, discountPercent);

  if (final !== null && discountPercent) {
    return (
      <div className={`flex flex-col ${large ? 'gap-0.5' : 'gap-0'}`}>
        <div className="flex items-center gap-2">
          <span className={`font-bold ${large ? 'text-2xl' : 'text-base'}`} style={{ color: 'var(--catalog-primary)' }}>
            {formatPrice(final)}
          </span>
          <span
            className="rounded-full bg-green-100 px-1.5 py-0.5 text-xs font-semibold text-green-700"
          >
            {Math.round(discountPercent)}% off
          </span>
        </div>
        <span className={`line-through ${large ? 'text-sm' : 'text-xs'}`} style={{ color: 'var(--catalog-ink-muted)' }}>
          {formatPrice(price)}
        </span>
      </div>
    );
  }

  return (
    <span className={`font-semibold ${large ? 'text-2xl' : 'text-base'}`} style={{ color: 'var(--catalog-ink)' }}>
      {formatPrice(price)}
    </span>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === 'AVAILABLE') return null;
  const label = status === 'SOLD' ? 'Sold' : 'Out of Stock';
  return (
    <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40">
      <span className="rounded-full bg-black/70 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white">
        {label}
      </span>
    </div>
  );
}

// ─── Product card ─────────────────────────────────────────────────────────────

function ProductCard({
  product,
  slug,
  onLike,
  liked,
  onProductClick,
}: {
  product: PublicProductListItem;
  slug: string;
  onLike?: (productId: number) => void;
  liked?: boolean;
  onProductClick?: () => void;
}) {
  const unavailable = product.status !== 'AVAILABLE';

  return (
    <div
      className="group relative flex flex-col overflow-hidden shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
      style={{
        border: '1px solid var(--catalog-hairline)',
        borderRadius: 'var(--catalog-card-radius)',
        background: 'var(--catalog-card)',
      }}
    >
      {/* Like button */}
      {onLike && (
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onLike(product.id); }}
          className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 shadow-sm backdrop-blur-sm transition-all hover:scale-110"
        >
          <Heart className={`h-4 w-4 transition-colors ${liked ? 'fill-red-500 text-red-500' : 'text-neutral-500'}`} />
        </button>
      )}
      <Link
        to={`/shop/${slug}/product/${product.id}`}
        className="flex flex-1 flex-col"
        onClick={onProductClick}
      >
        <div className="relative aspect-[3/4] w-full overflow-hidden bg-neutral-100" style={{ borderRadius: 'var(--catalog-card-radius) var(--catalog-card-radius) 0 0' }}>
          <ProductImage
            src={product.primary_image_url}
            alt={product.name}
            className={`h-full w-full transition-transform duration-500 group-hover:scale-105 ${unavailable ? 'opacity-70 grayscale-[30%]' : ''}`}
          />
          <StatusBadge status={product.status} />

          {product.discount_percent ? (
            <div
              className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-xs font-bold text-white shadow"
              style={{ background: 'var(--catalog-primary)' }}
            >
              -{Math.round(product.discount_percent)}%
            </div>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col p-3">
          <p className="line-clamp-2 text-sm font-medium leading-snug" style={{ color: 'var(--catalog-ink)' }}>
            {product.name}
          </p>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--catalog-ink-muted)' }}>{product.category.name}</p>
          {product.brand && <p className="mt-0.5 text-xs" style={{ color: 'var(--catalog-ink-muted)' }}>{product.brand}</p>}
          <div className="mt-auto flex items-end justify-between gap-2 pt-2">
            <PriceDisplay price={product.price} discountPercent={product.discount_percent} />
            {product.status === 'AVAILABLE' && <SelectionButton slug={slug} productId={product.id} />}
          </div>
          {product.quantity_available <= 3 && product.quantity_available > 0 && product.status === 'AVAILABLE' && (
            <p className="mt-1 text-xs font-medium text-amber-600">
              Only {product.quantity_available} left!
            </p>
          )}
        </div>
      </Link>
    </div>
  );
}

// ─── Bottom navigation (mobile) ───────────────────────────────────────────────

type NavTab = 'catalog' | 'search' | 'contact';

function BottomNav({
  activeTab,
  onTabChange,
  shopPhone,
}: {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  shopPhone: string | null;
}) {
  return (
    <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 sm:hidden">
      <div
        className="flex items-center gap-1 rounded-full px-2 py-2 shadow-2xl"
        style={{ background: 'var(--catalog-nav-bg)', backdropFilter: 'blur(12px)' }}
      >
        <NavPill
          label="Catalog"
          active={activeTab === 'catalog'}
          onClick={() => onTabChange('catalog')}
          icon={
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          }
        />
        <NavPill
          label="Search"
          active={activeTab === 'search'}
          onClick={() => onTabChange('search')}
          icon={<Search className="h-4 w-4" />}
        />
        {shopPhone && (
          <a
            href={`tel:${shopPhone}`}
            className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-yellow-300/80 transition-colors hover:text-yellow-200"
          >
            <Phone className="h-4 w-4" />
            <span>Call</span>
          </a>
        )}
      </div>
    </div>
  );
}

function NavPill({
  label,
  active,
  onClick,
  icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-all ${
        active
          ? 'bg-yellow-400/90 text-brand-900'
          : 'text-white/70 hover:text-white'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const SORT_OPTIONS: Array<{ value: SortOption; label: string }> = [
  { value: 'newest', label: 'Newest first' },
  { value: 'price_asc', label: 'Price: Low → High' },
  { value: 'price_desc', label: 'Price: High → Low' },
];

export default function ShopCatalogPage() {
  const { shopSlug } = useParams<{ shopSlug: string }>();
  const slug = shopSlug ?? '';
  const location = useLocation();
  const skipSplash = (location.state as { skipSplash?: boolean } | null)?.skipSplash === true;

  const [showSplash, setShowSplash] = useState(!skipSplash);
  const [activeTab, setActiveTab] = useState<NavTab>('catalog');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [sort, setSort] = useState<SortOption>('newest');
  const [page, setPage] = useState(1);
  const [activePromo, setActivePromo] = useState<PublicPromo | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [colorFilter, setColorFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');

  // Customer contact sheet
  const [showContactPopup, setShowContactPopup] = useState(false);
  const [contactDismissed, setContactDismissed] = useState(() => contactPromptDone());
  const productViewCount = useRef(0);

  // Likes tracked per session in memory
  const [likedProducts, setLikedProducts] = useState<Set<number>>(() => new Set());

  const handleLike = useCallback(
    (productId: number) => {
      toggleProductLike(slug, productId).then((result) => {
        setLikedProducts((prev) => {
          const next = new Set(prev);
          if (result.liked) next.add(productId);
          else next.delete(productId);
          return next;
        });
      });
    },
    [slug],
  );

  useEffect(() => {
    if (!contactDismissed && productViewCount.current >= 5 && !showContactPopup) {
      setShowContactPopup(true);
    }
  }, [contactDismissed, showContactPopup]);

  useEffect(() => {
    setPage(1);
  }, [search, categoryId, sort, colorFilter, brandFilter, priceMin, priceMax, activePromo]);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (activeTab === 'search') {
      setTimeout(() => searchRef.current?.focus(), 100);
    }
  }, [activeTab]);

  const {
    data: catalog,
    isLoading: shopLoading,
    isError: shopIsError,
    error: shopError,
  } = useQuery({
    queryKey: ['public', 'shop', slug],
    queryFn: () => getShopCatalog(slug),
    enabled: Boolean(slug),
    retry: false,
  });

  const shopUnavailable =
    shopIsError && shopError instanceof AxiosError && shopError.response?.status === 403;

  const PAGE_SIZE = 20;

  const promoDiscounted = activePromo?.kind === 'on_sale';
  const promoNewDays = activePromo?.kind === 'new_arrivals' ? 21 : undefined;
  const effectiveSort: SortOption = activePromo?.kind === 'new_collection' ? 'newest' : sort;

  const {
    data: productPage,
    isLoading: productsLoading,
    isError: productsIsError,
    refetch: refetchProducts,
  } = useQuery({
    queryKey: [
      'public',
      'products',
      slug,
      { categoryId, search, sort: effectiveSort, page, colorFilter, brandFilter, priceMin, priceMax, promo: activePromo?.key ?? null },
    ],
    queryFn: () =>
      listShopProducts(slug, {
        categoryId: categoryId || undefined,
        search: search || undefined,
        sort: effectiveSort,
        page,
        pageSize: PAGE_SIZE,
        color: colorFilter || undefined,
        brand: brandFilter || undefined,
        priceMin: priceMin ? Number(priceMin) : undefined,
        priceMax: priceMax ? Number(priceMax) : undefined,
        discounted: promoDiscounted || undefined,
        newWithinDays: promoNewDays,
      }),
    enabled: Boolean(slug) && Boolean(catalog),
  });

  const selectPromo = useCallback((promo: PublicPromo | null) => {
    setActivePromo(promo);
    if (promo) {
      setCategoryId('');
      setSearchInput('');
      setSearch('');
      setTimeout(() => gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    }
  }, []);

  if (shopLoading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: 'var(--catalog-splash-grad, linear-gradient(135deg, #691f2d, #932436))' }}
      >
        <Spinner />
      </div>
    );
  }

  if (shopUnavailable) {
    return (
      <CatalogUnavailablePage
        title="This catalog is currently unavailable."
        message="Please check back later, or contact the shop directly."
      />
    );
  }

  if (shopIsError || !catalog) {
    return (
      <CatalogUnavailablePage
        title="We couldn't find this catalog."
        message="Double check the link or QR code and try again."
      />
    );
  }

  const products = productPage?.items ?? [];
  const suggestions = productPage?.suggestions ?? null;
  const total = productPage?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasFilters = Boolean(
    search || categoryId || colorFilter || brandFilter || priceMin || priceMax || activePromo,
  );
  const activeFilterCount = [colorFilter, brandFilter, priceMin, priceMax].filter(Boolean).length;
  const priceRangeInverted = priceMin !== '' && priceMax !== '' && Number(priceMin) > Number(priceMax);
  const { shop, categories, theme, promos, hero_images } = catalog;

  const handleCategoryClick = (catId: number) => {
    const next = categoryId === catId ? '' : catId;
    setCategoryId(next);
    setActivePromo(null);
    if (next !== '') {
      setTimeout(() => gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    }
  };

  return (
    <CatalogThemeProvider theme={theme}>
      {/* Splash screen */}
      {showSplash && theme.splash_enabled && (
        <WelcomeSplash
          shopName={shop.name}
          tagline={theme.hero_tagline}
          ornate={theme.splash_style === 'ornate'}
          onEnter={() => setShowSplash(false)}
        />
      )}

      <div
        className="min-h-screen pb-24 sm:pb-8"
        style={{ background: 'var(--catalog-bg)' }}
      >
        {/* ── Compact header bar ── */}
        <header
          className="relative z-30 px-4 py-3 sm:px-6"
          style={{ background: 'var(--catalog-header-grad)' }}
        >
          <div className="mx-auto flex max-w-5xl items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              {shop.logo_url ? (
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-yellow-400/30 shadow">
                  <img src={shop.logo_url} alt={shop.name} className="h-full w-full object-cover" />
                </div>
              ) : (
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-yellow-400/30 shadow"
                  style={{
                    background:
                      'radial-gradient(circle at 35% 35%, var(--catalog-accent), color-mix(in srgb, var(--catalog-accent) 55%, #000))',
                  }}
                >
                  <span className="text-sm font-bold tracking-wider text-white">
                    {shopInitials(shop.name)}
                  </span>
                </div>
              )}
              <div className="min-w-0">
                <h1
                  className="truncate text-base font-bold uppercase tracking-wide text-white sm:text-lg"
                  style={{ fontFamily: 'var(--catalog-heading-font)' }}
                >
                  {shop.name}
                </h1>
                {shop.city && (
                  <p className="text-[10px] font-medium tracking-widest text-yellow-300/60 uppercase">
                    {shop.city}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {shop.phone && (
                <a
                  href={`tel:${shop.phone}`}
                  className="hidden items-center gap-1.5 rounded-full border border-white/20 px-3 py-1.5 text-xs font-medium text-white/80 transition-colors hover:bg-white/10 sm:flex"
                >
                  <Phone className="h-3.5 w-3.5" />
                  {shop.phone}
                </a>
              )}
            </div>
          </div>
        </header>

        {/* ── Hero Banner ── */}
        <HeroBanner
          images={hero_images}
          tagline={theme.hero_tagline}
        />

        {/* ── Trust badges ── */}
        <TrustBadges />

        {/* ── Promo banners ── */}
        {promos.length > 0 && (
          <div className="mx-auto max-w-5xl px-4 pt-6 sm:px-6">
            <PromoCarousel
              promos={promos}
              activeKey={activePromo?.key ?? null}
              onSelect={selectPromo}
            />
          </div>
        )}

        {/* ── Shop by Collection ── */}
        {categories.length > 0 && (
          <section id="collections" className="mx-auto max-w-5xl px-4 pt-8 sm:px-6">
            <SectionHeading
              title="Shop by Collection"
              subtitle="Browse our carefully curated categories"
            />
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
              {categories.map((cat) => (
                <CollectionCard
                  key={cat.id}
                  name={cat.name}
                  imageUrl={cat.cover_image_url}
                  active={categoryId === cat.id}
                  onClick={() => handleCategoryClick(cat.id)}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Featured Products heading ── */}
        <div className="mx-auto max-w-5xl px-4 pt-10 sm:px-6">
          <SectionHeading
            title={categoryId ? categories.find((c) => c.id === categoryId)?.name ?? 'Products' : 'Our Collection'}
            subtitle={activePromo ? activePromo.title : undefined}
          />
        </div>

        {/* ── Search + sort bar ── */}
        <div
          className="sticky top-0 z-20 border-b px-4 py-3 sm:px-6"
          style={{
            background: 'var(--catalog-bg)',
            backdropFilter: 'blur(12px)',
            borderColor: 'var(--catalog-hairline)',
          }}
        >
          <div className="mx-auto flex max-w-5xl items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--catalog-ink-muted)' }} />
              <input
                ref={searchRef}
                type="search"
                inputMode="search"
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  setActiveTab('search');
                }}
                onFocus={() => setActiveTab('search')}
                placeholder="Search products…"
                className="w-full rounded-full border py-2.5 pl-9 pr-4 text-sm focus:outline-none focus:ring-2"
                style={{
                  borderColor: 'var(--catalog-hairline)',
                  background: 'var(--catalog-card)',
                  color: 'var(--catalog-ink)',
                  // @ts-ignore
                  '--tw-ring-color': 'var(--catalog-primary)',
                }}
              />
            </div>
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className="relative flex items-center gap-1 rounded-full border px-3 py-2 text-xs font-medium transition-colors focus:outline-none"
              style={{ borderColor: 'var(--catalog-hairline)', color: 'var(--catalog-primary)' }}
            >
              <Filter className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Filters</span>
              {activeFilterCount > 0 && (
                <span
                  className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{ background: 'var(--catalog-primary)' }}
                >
                  {activeFilterCount}
                </span>
              )}
            </button>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              className="hidden rounded-full border px-3 py-2 text-xs font-medium sm:block focus:outline-none"
              style={{ borderColor: 'var(--catalog-hairline)', color: 'var(--catalog-primary)' }}
              aria-label="Sort products"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* Filter panel */}
          {showFilters && (
            <div className="mx-auto mt-3 flex max-w-5xl flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium" style={{ color: 'var(--catalog-ink-muted)' }}>Color</span>
                <input
                  type="text"
                  value={colorFilter}
                  onChange={(e) => setColorFilter(e.target.value)}
                  placeholder="e.g. Red"
                  className="w-28 rounded-lg border px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1"
                  style={{ borderColor: 'var(--catalog-hairline)', color: 'var(--catalog-ink)' }}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium" style={{ color: 'var(--catalog-ink-muted)' }}>Brand</span>
                <input
                  type="text"
                  value={brandFilter}
                  onChange={(e) => setBrandFilter(e.target.value)}
                  placeholder="e.g. Banarasi"
                  className="w-28 rounded-lg border px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1"
                  style={{ borderColor: 'var(--catalog-hairline)', color: 'var(--catalog-ink)' }}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium" style={{ color: 'var(--catalog-ink-muted)' }}>Min price</span>
                <input
                  type="number"
                  value={priceMin}
                  onChange={(e) => setPriceMin(e.target.value)}
                  placeholder="₹0"
                  min="0"
                  className="w-24 rounded-lg border px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1"
                  style={{ borderColor: 'var(--catalog-hairline)', color: 'var(--catalog-ink)' }}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium" style={{ color: 'var(--catalog-ink-muted)' }}>Max price</span>
                <input
                  type="number"
                  value={priceMax}
                  onChange={(e) => setPriceMax(e.target.value)}
                  placeholder="No limit"
                  min="0"
                  className="w-24 rounded-lg border px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1"
                  style={{ borderColor: 'var(--catalog-hairline)', color: 'var(--catalog-ink)' }}
                />
              </label>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={() => { setColorFilter(''); setBrandFilter(''); setPriceMin(''); setPriceMax(''); }}
                  className="rounded-full px-3 py-1.5 text-xs font-medium hover:opacity-80"
                  style={{ color: 'var(--catalog-primary)' }}
                >
                  Clear filters
                </button>
              )}
              {priceRangeInverted && (
                <p className="w-full text-xs text-amber-600">
                  Min price is higher than max — we swapped them automatically.
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── Product grid ── */}
        <main ref={gridRef} className="mx-auto max-w-5xl px-4 pt-4 sm:px-6">
          {activePromo && (
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold" style={{ color: 'var(--catalog-primary)' }}>
                {activePromo.title}
                <span className="ml-2 text-xs font-normal" style={{ color: 'var(--catalog-ink-muted)' }}>
                  {total} item{total === 1 ? '' : 's'}
                </span>
              </p>
              <button
                type="button"
                onClick={() => setActivePromo(null)}
                className="rounded-full border px-3 py-1 text-xs font-medium"
                style={{ borderColor: 'var(--catalog-hairline)', color: 'var(--catalog-primary)' }}
              >
                Clear
              </button>
            </div>
          )}
          {/* Mobile sort */}
          <div className="mb-3 flex items-center justify-between sm:hidden">
            <p className="text-xs" style={{ color: 'var(--catalog-ink-muted)' }}>
              {total > 0 ? `${total} item${total === 1 ? '' : 's'}` : ''}
            </p>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              className="rounded-full border px-3 py-1.5 text-xs font-medium focus:outline-none"
              style={{ borderColor: 'var(--catalog-hairline)', color: 'var(--catalog-primary)' }}
              aria-label="Sort products"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {productsLoading && (
            <div className="flex justify-center py-16">
              <Spinner />
            </div>
          )}

          {productsIsError && (
            <div className="flex flex-col items-center py-16 text-center">
              <p className="text-sm" style={{ color: 'var(--catalog-ink-muted)' }}>Could not load products right now.</p>
              <button
                type="button"
                onClick={() => refetchProducts()}
                className="mt-3 rounded-full px-4 py-1.5 text-sm font-medium underline"
                style={{ color: 'var(--catalog-primary)' }}
              >
                Try again
              </button>
            </div>
          )}

          {!productsLoading && !productsIsError && products.length === 0 && !hasFilters && (
            <div
              className="flex flex-col items-center border border-dashed px-6 py-16 text-center"
              style={{ borderColor: 'var(--catalog-hairline)', borderRadius: 'var(--catalog-card-radius)', background: 'var(--catalog-card)' }}
            >
              <Package className="h-8 w-8" style={{ color: 'var(--catalog-ink-muted)' }} />
              <p className="mt-3 text-sm font-medium" style={{ color: 'var(--catalog-ink)' }}>No products yet</p>
              <p className="mt-1 text-xs" style={{ color: 'var(--catalog-ink-muted)' }}>
                This shop hasn't added any products to their catalog yet.
              </p>
            </div>
          )}

          {!productsLoading && !productsIsError && products.length === 0 && hasFilters && (
            <div className="space-y-6">
              <div
                className="flex flex-col items-center border border-dashed px-6 py-10 text-center"
                style={{ borderColor: 'var(--catalog-hairline)', borderRadius: 'var(--catalog-card-radius)', background: 'var(--catalog-card)' }}
              >
                <Search className="h-8 w-8" style={{ color: 'var(--catalog-ink-muted)' }} />
                <p className="mt-3 text-sm font-medium" style={{ color: 'var(--catalog-ink)' }}>No exact matches found</p>
                <p className="mt-1 text-xs" style={{ color: 'var(--catalog-ink-muted)' }}>Try adjusting your search or filters</p>
                <button
                  type="button"
                  onClick={() => { setSearchInput(''); setCategoryId(''); setColorFilter(''); setBrandFilter(''); setPriceMin(''); setPriceMax(''); setActivePromo(null); }}
                  className="mt-3 rounded-full px-4 py-1.5 text-xs font-medium text-white"
                  style={{ background: 'var(--catalog-primary)' }}
                >
                  Clear all filters
                </button>
              </div>

              {suggestions && suggestions.length > 0 && (
                <div>
                  <h3 className="mb-3 text-sm font-semibold" style={{ color: 'var(--catalog-ink)' }}>
                    You might also like
                  </h3>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                    {suggestions.map((product) => (
                      <ProductCard key={product.id} product={product} slug={slug} onLike={handleLike} liked={likedProducts.has(product.id)} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {products.length > 0 && (
            <>
              <p className="mb-3 hidden text-xs sm:block" style={{ color: 'var(--catalog-ink-muted)' }}>
                {total} item{total === 1 ? '' : 's'}
              </p>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    slug={slug}
                    onLike={handleLike}
                    liked={likedProducts.has(product.id)}
                    onProductClick={() => {
                      productViewCount.current += 1;
                      if (!contactDismissed && productViewCount.current >= 5) {
                        setShowContactPopup(true);
                      }
                    }}
                  />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 py-8">
                  <button
                    type="button"
                    onClick={() => { setPage((p) => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    disabled={page <= 1}
                    className="rounded-full border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-40"
                    style={{ borderColor: 'var(--catalog-hairline)', color: 'var(--catalog-primary)' }}
                  >
                    Previous
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                    .reduce<(number | 'ellipsis')[]>((acc, p, idx, arr) => {
                      if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('ellipsis');
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, idx) =>
                      p === 'ellipsis' ? (
                        <span key={`e${idx}`} className="px-1 text-sm" style={{ color: 'var(--catalog-ink-muted)' }}>…</span>
                      ) : (
                        <button
                          key={p}
                          type="button"
                          onClick={() => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                          className={`h-9 w-9 rounded-full text-sm font-medium transition-colors ${
                            page === p
                              ? 'text-white shadow-sm'
                              : 'border hover:opacity-80'
                          }`}
                          style={
                            page === p
                              ? { background: 'linear-gradient(135deg, var(--catalog-primary), var(--catalog-accent))' }
                              : { borderColor: 'var(--catalog-hairline)', color: 'var(--catalog-ink)' }
                          }
                        >
                          {p}
                        </button>
                      ),
                    )}
                  <button
                    type="button"
                    onClick={() => { setPage((p) => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    disabled={page >= totalPages}
                    className="rounded-full border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-40"
                    style={{ borderColor: 'var(--catalog-hairline)', color: 'var(--catalog-primary)' }}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Customer contact sheet */}
      {showContactPopup && (
        <CustomerContactSheet
          shopSlug={slug}
          reason="browse"
          onClose={() => {
            setShowContactPopup(false);
            setContactDismissed(true);
          }}
          onSaved={() => {
            setShowContactPopup(false);
            setContactDismissed(true);
          }}
        />
      )}

      {/* Floating "My Choice" bar */}
      <SelectionBar slug={slug} />

      {/* Bottom nav (mobile only) */}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} shopPhone={shop.phone} />
    </CatalogThemeProvider>
  );
}
