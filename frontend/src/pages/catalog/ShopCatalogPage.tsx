import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  Heart,
  Phone,
  Search,
  SlidersHorizontal,
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
import type { PublicCategory, PublicProductListItem, PublicPromo } from '@/types/publicCatalog';

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
  coverImage,
  onEnter,
}: {
  shopName: string;
  tagline: string;
  coverImage: string | null;
  onEnter: () => void;
}) {
  const initials = shopInitials(shopName);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden">
      {/* Background */}
      {coverImage ? (
        <>
          <img
            src={coverImage}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.55) 50%, rgba(0,0,0,0.35) 100%)' }}
          />
        </>
      ) : (
        <div className="absolute inset-0" style={{ background: 'var(--catalog-splash-grad)' }} />
      )}

      {/* Content */}
      <div className="relative flex flex-col items-center px-8 text-center">
        {/* Avatar */}
        <div
          className="mb-7 flex h-24 w-24 items-center justify-center rounded-full shadow-2xl"
          style={{
            background:
              'radial-gradient(circle at 35% 35%, var(--catalog-accent), color-mix(in srgb, var(--catalog-accent) 50%, #000))',
            boxShadow: '0 0 0 3px rgba(255,255,255,0.15), 0 20px 40px rgba(0,0,0,0.4)',
          }}
        >
          <span className="text-3xl font-bold tracking-widest text-white">{initials}</span>
        </div>

        {/* Shop name */}
        <h1
          className="text-3xl font-bold uppercase tracking-[0.12em] text-white drop-shadow-lg sm:text-4xl"
          style={{ fontFamily: 'var(--catalog-heading-font)', textWrap: 'balance' }}
        >
          {shopName}
        </h1>

        {/* Tagline */}
        <p
          className="mt-3 text-sm font-light uppercase tracking-[0.2em] text-white/60"
        >
          {tagline}
        </p>

        {/* Divider */}
        <div className="my-8 flex items-center gap-3">
          <div className="h-px w-12" style={{ background: 'var(--catalog-accent)' }} />
          <div
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: 'var(--catalog-accent)' }}
          />
          <div className="h-px w-12" style={{ background: 'var(--catalog-accent)' }} />
        </div>

        {/* CTA */}
        <button
          type="button"
          onClick={onEnter}
          className="rounded-full px-10 py-3.5 text-sm font-semibold uppercase tracking-[0.18em] text-white transition-all active:scale-95"
          style={{
            background: 'var(--catalog-primary)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          }}
        >
          Enter Store
        </button>
      </div>
    </div>
  );
}

// ─── Hero Banner Carousel ────────────────────────────────────────────────────

function HeroBanner({
  images,
  shopName,
  tagline,
}: {
  images: string[];
  shopName: string;
  tagline: string;
}) {
  const [active, setActive] = useState(0);
  const count = images.length;

  useEffect(() => {
    if (count <= 1) return;
    const id = setInterval(() => setActive((i) => (i + 1) % count), 5000);
    return () => clearInterval(id);
  }, [count]);

  const prev = () => setActive((i) => (i - 1 + count) % count);
  const next = () => setActive((i) => (i + 1) % count);

  const hasImages = count > 0;

  return (
    <div
      className="relative overflow-hidden"
      style={{ minHeight: 'clamp(240px, 55vw, 500px)' }}
    >
      {/* Background */}
      {hasImages ? (
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
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.35) 45%, rgba(0,0,0,0.1) 100%)',
            }}
          />
        </div>
      ) : (
        <>
          <div className="absolute inset-0" style={{ background: 'var(--catalog-header-grad)' }} />
          {/* Large background initial as texture */}
          <div className="absolute inset-0 flex items-center justify-center overflow-hidden select-none pointer-events-none">
            <span
              className="font-bold text-white/[0.06] leading-none"
              style={{
                fontSize: 'clamp(140px, 35vw, 300px)',
                fontFamily: 'var(--catalog-heading-font)',
              }}
            >
              {shopInitials(shopName)}
            </span>
          </div>
        </>
      )}

      {/* Text content */}
      <div
        className="relative flex h-full items-end"
        style={{ minHeight: 'clamp(240px, 55vw, 500px)' }}
      >
        <div className="w-full px-5 pb-8 sm:px-8 sm:pb-10">
          {/* Accent pill */}
          <div
            className="mb-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-widest"
            style={{ background: 'var(--catalog-accent)', color: '#1a0a00' }}
          >
            <span>✦</span>
            <span>New Collection</span>
          </div>

          <h2
            className="text-2xl font-bold leading-tight text-white drop-shadow-lg sm:text-4xl md:text-5xl"
            style={{
              fontFamily: 'var(--catalog-heading-font)',
              textShadow: '0 2px 12px rgba(0,0,0,0.4)',
              textWrap: 'balance',
            }}
          >
            {tagline}
          </h2>

          <p className="mt-2 text-sm text-white/65 sm:text-base">
            Explore our curated collection
          </p>

          {/* Carousel dots */}
          {count > 1 && (
            <div className="mt-5 flex items-center gap-1.5">
              {images.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActive(i)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === active ? 'w-6' : 'w-1.5 bg-white/40 hover:bg-white/60'
                  }`}
                  style={i === active ? { background: 'var(--catalog-accent)' } : undefined}
                  aria-label={`Slide ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Prev / Next arrows (desktop only) */}
      {count > 1 && (
        <>
          <button
            type="button"
            onClick={prev}
            className="absolute left-4 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full bg-black/25 p-2.5 text-white backdrop-blur-sm transition-all hover:bg-black/45 sm:flex"
            aria-label="Previous slide"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={next}
            className="absolute right-4 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full bg-black/25 p-2.5 text-white backdrop-blur-sm transition-all hover:bg-black/45 sm:flex"
            aria-label="Next slide"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}
    </div>
  );
}

// ─── Category chip strip ──────────────────────────────────────────────────────

function CategoryChips({
  categories,
  activeId,
  onSelect,
}: {
  categories: PublicCategory[];
  activeId: number | '';
  onSelect: (id: number | '') => void;
}) {
  if (categories.length === 0) return null;

  return (
    <div
      className="border-b"
      style={{ borderColor: 'var(--catalog-hairline)', background: 'var(--catalog-bg)' }}
    >
      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex gap-2 px-4 py-3 min-w-max sm:px-6">
          {/* All */}
          <button
            type="button"
            onClick={() => onSelect('')}
            className={`flex h-8 items-center rounded-full px-4 text-xs font-semibold whitespace-nowrap border transition-all ${
              activeId === ''
                ? 'border-transparent text-white'
                : 'border-[var(--catalog-hairline)] text-[var(--catalog-ink)] hover:border-[var(--catalog-primary)]'
            }`}
            style={
              activeId === ''
                ? { background: 'var(--catalog-primary)', color: '#fff' }
                : { background: 'var(--catalog-card)' }
            }
          >
            All
          </button>

          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelect(activeId === cat.id ? '' : cat.id)}
              className={`flex h-8 items-center gap-1.5 rounded-full px-4 text-xs font-semibold whitespace-nowrap border transition-all ${
                activeId === cat.id
                  ? 'border-transparent text-white'
                  : 'border-[var(--catalog-hairline)] text-[var(--catalog-ink)] hover:border-[var(--catalog-primary)]'
              }`}
              style={
                activeId === cat.id
                  ? { background: 'var(--catalog-primary)', color: '#fff' }
                  : { background: 'var(--catalog-card)' }
              }
            >
              {cat.cover_image_url && (
                <img
                  src={cat.cover_image_url}
                  alt=""
                  className="h-4 w-4 rounded-full object-cover"
                />
              )}
              {cat.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Section heading ──────────────────────────────────────────────────────────

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-3">
        <div
          className="h-5 w-1 shrink-0 rounded-full"
          style={{ background: 'var(--catalog-primary)' }}
        />
        <h2
          className="text-lg font-bold sm:text-xl"
          style={{ color: 'var(--catalog-ink)', fontFamily: 'var(--catalog-heading-font)' }}
        >
          {title}
        </h2>
      </div>
      {subtitle && (
        <p className="pl-4 text-xs" style={{ color: 'var(--catalog-ink-muted)' }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

// ─── Price display with optional discount ────────────────────────────────────

function PriceDisplay({
  price,
  discountPercent,
}: {
  price: number;
  discountPercent: number | null;
}) {
  const final = discountedPrice(price, discountPercent);

  if (final !== null && discountPercent) {
    return (
      <div className="flex flex-col gap-0">
        <span className="text-base font-bold" style={{ color: 'var(--catalog-primary)' }}>
          {formatPrice(final)}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-xs line-through" style={{ color: 'var(--catalog-ink-muted)' }}>
            {formatPrice(price)}
          </span>
          <span className="rounded-sm bg-emerald-50 px-1 py-px text-[10px] font-bold text-emerald-700">
            {Math.round(discountPercent)}% off
          </span>
        </div>
      </div>
    );
  }

  return (
    <span className="text-base font-bold" style={{ color: 'var(--catalog-ink)' }}>
      {formatPrice(price)}
    </span>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === 'AVAILABLE') return null;
  const label = status === 'SOLD' ? 'Sold Out' : 'Out of Stock';
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
      <span className="rounded-full bg-black/75 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-white">
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
      className="group relative flex flex-col overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-lg"
      style={{
        border: '1px solid var(--catalog-hairline)',
        borderRadius: 'var(--catalog-card-radius)',
        background: 'var(--catalog-card)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}
    >
      {/* Image area */}
      <Link
        to={`/shop/${slug}/product/${product.id}`}
        className="block"
        onClick={onProductClick}
      >
        <div
          className="relative aspect-[3/4] w-full overflow-hidden bg-neutral-100"
          style={{
            borderRadius: 'calc(var(--catalog-card-radius) - 1px) calc(var(--catalog-card-radius) - 1px) 0 0',
          }}
        >
          <ProductImage
            src={product.primary_image_url}
            alt={product.name}
            className={`h-full w-full transition-transform duration-500 group-hover:scale-105 ${
              unavailable ? 'opacity-65 grayscale-[25%]' : ''
            }`}
          />
          <StatusBadge status={product.status} />

          {product.discount_percent ? (
            <div
              className="absolute left-2 top-2 rounded-sm px-1.5 py-0.5 text-[11px] font-bold text-white"
              style={{ background: 'var(--catalog-primary)' }}
            >
              -{Math.round(product.discount_percent)}%
            </div>
          ) : null}

          {/* Heart button */}
          {onLike && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onLike(product.id);
              }}
              className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/85 shadow-sm backdrop-blur-sm transition-all hover:scale-110 active:scale-95"
            >
              <Heart
                className={`h-3.5 w-3.5 transition-colors ${
                  liked ? 'fill-red-500 text-red-500' : 'text-neutral-400'
                }`}
              />
            </button>
          )}
        </div>
      </Link>

      {/* Footer */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        <Link
          to={`/shop/${slug}/product/${product.id}`}
          className="block"
          onClick={onProductClick}
        >
          <p
            className="line-clamp-2 text-sm font-medium leading-snug"
            style={{ color: 'var(--catalog-ink)' }}
          >
            {product.name}
          </p>
          <p className="mt-0.5 text-[11px]" style={{ color: 'var(--catalog-ink-muted)' }}>
            {product.category.name}
          </p>
        </Link>

        <div className="mt-auto flex items-end justify-between gap-1.5">
          <PriceDisplay price={product.price} discountPercent={product.discount_percent} />
          {product.status === 'AVAILABLE' && (
            <SelectionButton slug={slug} productId={product.id} />
          )}
        </div>

        {product.quantity_available <= 3 &&
          product.quantity_available > 0 &&
          product.status === 'AVAILABLE' && (
            <p className="text-[11px] font-semibold text-amber-600">
              Only {product.quantity_available} left!
            </p>
          )}
      </div>
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
        className="flex items-center gap-0.5 rounded-2xl px-2 py-2 shadow-2xl"
        style={{
          background: 'var(--catalog-nav-bg)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.12)',
        }}
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
            className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-colors"
            style={{ color: 'var(--catalog-accent)' }}
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
      className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
        active ? 'text-white' : 'text-white/55 hover:text-white/80'
      }`}
      style={active ? { background: 'var(--catalog-primary)' } : undefined}
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
      {
        categoryId,
        search,
        sort: effectiveSort,
        page,
        colorFilter,
        brandFilter,
        priceMin,
        priceMax,
        promo: activePromo?.key ?? null,
      },
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
  const priceRangeInverted =
    priceMin !== '' && priceMax !== '' && Number(priceMin) > Number(priceMax);
  const { shop, categories, theme, promos, hero_images } = catalog;

  const handleCategorySelect = (id: number | '') => {
    setCategoryId(id);
    setActivePromo(null);
    if (id !== '') {
      setTimeout(() => gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    }
  };

  const activeCategoryName = categories.find((c) => c.id === categoryId)?.name;

  return (
    <CatalogThemeProvider theme={theme}>
      {/* Splash screen */}
      {showSplash && theme.splash_enabled && (
        <WelcomeSplash
          shopName={shop.name}
          tagline={theme.hero_tagline}
          coverImage={hero_images[0] ?? null}
          onEnter={() => setShowSplash(false)}
        />
      )}

      <div className="min-h-screen pb-24 sm:pb-8" style={{ background: 'var(--catalog-bg)' }}>
        {/* ── Header ── */}
        <header
          className="relative z-30 px-4 py-3 sm:px-6"
          style={{ background: 'var(--catalog-header-grad)' }}
        >
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <div className="flex min-w-0 items-center gap-3">
              {/* Logo / initials */}
              {shop.logo_url ? (
                <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg">
                  <img src={shop.logo_url} alt={shop.name} className="h-full w-full object-cover" />
                </div>
              ) : (
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                  style={{
                    background:
                      'radial-gradient(circle at 35% 35%, var(--catalog-accent), color-mix(in srgb, var(--catalog-accent) 55%, #000))',
                  }}
                >
                  <span className="text-xs font-bold tracking-wide text-white">
                    {shopInitials(shop.name)}
                  </span>
                </div>
              )}

              <div className="min-w-0">
                <h1
                  className="truncate text-sm font-bold uppercase tracking-wide text-white sm:text-base"
                  style={{ fontFamily: 'var(--catalog-heading-font)' }}
                >
                  {shop.name}
                </h1>
                {shop.city && (
                  <p className="text-[10px] uppercase tracking-widest text-white/50">
                    {shop.city}
                  </p>
                )}
              </div>
            </div>

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
        </header>

        {/* ── Hero ── */}
        <HeroBanner
          images={hero_images}
          shopName={shop.name}
          tagline={theme.hero_tagline}
        />

        {/* ── Category chips ── */}
        {categories.length > 0 && (
          <CategoryChips
            categories={categories}
            activeId={categoryId}
            onSelect={handleCategorySelect}
          />
        )}

        {/* ── Promo banners ── */}
        {promos.length > 0 && (
          <div className="mx-auto max-w-6xl px-4 pt-5 sm:px-6">
            <PromoCarousel
              promos={promos}
              activeKey={activePromo?.key ?? null}
              onSelect={selectPromo}
            />
          </div>
        )}

        {/* ── Products section ── */}
        <section ref={gridRef} className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
          {/* Section heading */}
          <SectionHeading
            title={activeCategoryName ?? (activePromo ? activePromo.title : 'All Products')}
            subtitle={
              activePromo && !activeCategoryName
                ? activePromo.subtitle
                : total > 0
                ? `${total} product${total !== 1 ? 's' : ''}`
                : undefined
            }
          />

          {/* ── Sticky search + filter bar ── */}
          <div
            className="sticky top-0 z-20 -mx-4 mt-4 border-b px-4 py-2.5 sm:-mx-6 sm:px-6"
            style={{
              background: 'var(--catalog-bg)',
              backdropFilter: 'blur(12px)',
              borderColor: 'var(--catalog-hairline)',
            }}
          >
            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="relative flex-1">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                  style={{ color: 'var(--catalog-ink-muted)' }}
                />
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
                  className="w-full rounded-full border py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2"
                  style={{
                    borderColor: 'var(--catalog-hairline)',
                    background: 'var(--catalog-card)',
                    color: 'var(--catalog-ink)',
                    // @ts-ignore
                    '--tw-ring-color': 'var(--catalog-primary)',
                  }}
                />
              </div>

              {/* Filter button */}
              <button
                type="button"
                onClick={() => setShowFilters((v) => !v)}
                className="relative flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium transition-colors focus:outline-none"
                style={{
                  borderColor: showFilters ? 'var(--catalog-primary)' : 'var(--catalog-hairline)',
                  color: 'var(--catalog-primary)',
                  background: showFilters
                    ? 'color-mix(in srgb, var(--catalog-primary) 8%, transparent)'
                    : 'var(--catalog-card)',
                }}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
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

              {/* Sort */}
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortOption)}
                className="hidden rounded-full border px-3 py-2 text-xs font-medium focus:outline-none sm:block"
                style={{
                  borderColor: 'var(--catalog-hairline)',
                  color: 'var(--catalog-ink)',
                  background: 'var(--catalog-card)',
                }}
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
              <div
                className="mt-3 flex flex-wrap items-end gap-3 rounded-xl border p-3"
                style={{ borderColor: 'var(--catalog-hairline)', background: 'var(--catalog-card)' }}
              >
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--catalog-ink-muted)' }}>
                    Color
                  </span>
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
                  <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--catalog-ink-muted)' }}>
                    Brand
                  </span>
                  <input
                    type="text"
                    value={brandFilter}
                    onChange={(e) => setBrandFilter(e.target.value)}
                    placeholder="e.g. Kanjivaram"
                    className="w-32 rounded-lg border px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1"
                    style={{ borderColor: 'var(--catalog-hairline)', color: 'var(--catalog-ink)' }}
                  />
                </label>
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--catalog-ink-muted)' }}>
                    Price Range (₹)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      value={priceMin}
                      onChange={(e) => setPriceMin(e.target.value)}
                      placeholder="Min"
                      className="w-20 rounded-lg border px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1"
                      style={{ borderColor: 'var(--catalog-hairline)', color: 'var(--catalog-ink)' }}
                    />
                    <span className="text-xs" style={{ color: 'var(--catalog-ink-muted)' }}>—</span>
                    <input
                      type="number"
                      value={priceMax}
                      onChange={(e) => setPriceMax(e.target.value)}
                      placeholder="Max"
                      className="w-20 rounded-lg border px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1"
                      style={{ borderColor: 'var(--catalog-hairline)', color: 'var(--catalog-ink)' }}
                    />
                  </div>
                  {priceRangeInverted && (
                    <p className="text-[10px] text-red-500">Min must be less than Max</p>
                  )}
                </div>

                {/* Mobile: sort */}
                <label className="flex flex-col gap-1 sm:hidden">
                  <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--catalog-ink-muted)' }}>
                    Sort
                  </span>
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as SortOption)}
                    className="rounded-lg border px-2.5 py-1.5 text-xs focus:outline-none"
                    style={{ borderColor: 'var(--catalog-hairline)', color: 'var(--catalog-ink)' }}
                  >
                    {SORT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>

                {/* Clear filters */}
                {(colorFilter || brandFilter || priceMin || priceMax) && (
                  <button
                    type="button"
                    onClick={() => {
                      setColorFilter('');
                      setBrandFilter('');
                      setPriceMin('');
                      setPriceMax('');
                    }}
                    className="self-end rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
                    style={{
                      borderColor: 'var(--catalog-primary)',
                      color: 'var(--catalog-primary)',
                    }}
                  >
                    Clear all
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Active filters summary */}
          {hasFilters && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {search && (
                <span
                  className="flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs"
                  style={{ borderColor: 'var(--catalog-hairline)', color: 'var(--catalog-ink-muted)' }}
                >
                  "{search}"
                  <button
                    type="button"
                    onClick={() => { setSearchInput(''); setSearch(''); }}
                    className="ml-0.5 opacity-60 hover:opacity-100"
                  >
                    ×
                  </button>
                </span>
              )}
              {activePromo && (
                <span
                  className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-white"
                  style={{ background: 'var(--catalog-primary)' }}
                >
                  {activePromo.title}
                  <button
                    type="button"
                    onClick={() => selectPromo(null)}
                    className="ml-0.5 opacity-80 hover:opacity-100"
                  >
                    ×
                  </button>
                </span>
              )}
            </div>
          )}

          {/* ── Product grid ── */}
          <div className="mt-4">
            {productsLoading ? (
              <div className="flex items-center justify-center py-16">
                <Spinner />
              </div>
            ) : productsIsError ? (
              <div className="py-12 text-center">
                <p className="text-sm" style={{ color: 'var(--catalog-ink-muted)' }}>
                  Couldn't load products.{' '}
                  <button
                    type="button"
                    onClick={() => refetchProducts()}
                    className="font-medium underline"
                    style={{ color: 'var(--catalog-primary)' }}
                  >
                    Retry
                  </button>
                </p>
              </div>
            ) : products.length === 0 ? (
              <div className="py-16 text-center">
                {hasFilters ? (
                  <>
                    <p className="text-base font-medium" style={{ color: 'var(--catalog-ink)' }}>
                      No results
                    </p>
                    <p className="mt-1 text-sm" style={{ color: 'var(--catalog-ink-muted)' }}>
                      Try adjusting your search or filters
                    </p>
                    {suggestions && suggestions.length > 0 && (
                      <div className="mt-8">
                        <p className="mb-4 text-sm font-medium" style={{ color: 'var(--catalog-ink)' }}>
                          You might also like
                        </p>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                          {suggestions.map((p) => (
                            <ProductCard
                              key={p.id}
                              product={p}
                              slug={slug}
                              onLike={handleLike}
                              liked={likedProducts.has(p.id)}
                              onProductClick={() => {
                                productViewCount.current += 1;
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm" style={{ color: 'var(--catalog-ink-muted)' }}>
                    No products yet. Check back soon!
                  </p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    slug={slug}
                    onLike={handleLike}
                    liked={likedProducts.has(product.id)}
                    onProductClick={() => {
                      productViewCount.current += 1;
                    }}
                  />
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2 pb-4">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex h-9 w-9 items-center justify-center rounded-full border transition-colors disabled:opacity-40"
                  style={{
                    borderColor: 'var(--catalog-hairline)',
                    color: 'var(--catalog-ink)',
                    background: 'var(--catalog-card)',
                  }}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                <span className="px-3 text-sm" style={{ color: 'var(--catalog-ink-muted)' }}>
                  {page} / {totalPages}
                </span>

                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="flex h-9 w-9 items-center justify-center rounded-full border transition-colors disabled:opacity-40"
                  style={{
                    borderColor: 'var(--catalog-hairline)',
                    color: 'var(--catalog-ink)',
                    background: 'var(--catalog-card)',
                  }}
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Selection bar (sticky bottom, desktop) */}
      <SelectionBar slug={slug} />

      {/* Contact sheet */}
      <CustomerContactSheet
        slug={slug}
        open={showContactPopup}
        onClose={() => {
          setShowContactPopup(false);
          setContactDismissed(true);
        }}
      />

      {/* Bottom navigation (mobile) */}
      <BottomNav
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          if (tab === 'contact') setShowContactPopup(true);
        }}
        shopPhone={shop.phone}
      />
    </CatalogThemeProvider>
  );
}
