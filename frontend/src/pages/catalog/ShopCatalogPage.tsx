import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { Package, Phone, Search, Sparkles } from 'lucide-react';
import { getShopCatalog, listShopProducts, type SortOption } from '@/services/publicCatalog';
import { formatPrice } from '@/utils/currency';
import ProductImage from '@/components/catalog/ProductImage';
import Spinner from '@/components/Spinner';
import CatalogUnavailablePage from './CatalogUnavailablePage';
import type { PublicProductListItem } from '@/types/publicCatalog';

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
  return price * (1 - discountPercent / 100);
}

// ─── Welcome / Splash screen ──────────────────────────────────────────────────

function WelcomeSplash({ shopName, onEnter }: { shopName: string; onEnter: () => void }) {
  const initials = shopInitials(shopName);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{
        background: 'linear-gradient(135deg, #4a0a14 0%, #8B1A1A 40%, #6b1520 70%, #3d0a10 100%)',
      }}
    >
      {/* Decorative corner ornaments */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <svg className="absolute left-0 top-0 h-48 w-48 opacity-10" viewBox="0 0 200 200" fill="none">
          <circle cx="0" cy="0" r="180" stroke="#C9A84C" strokeWidth="1" />
          <circle cx="0" cy="0" r="150" stroke="#C9A84C" strokeWidth="0.5" />
          <circle cx="0" cy="0" r="120" stroke="#C9A84C" strokeWidth="0.5" />
        </svg>
        <svg className="absolute bottom-0 right-0 h-48 w-48 opacity-10" viewBox="0 0 200 200" fill="none">
          <circle cx="200" cy="200" r="180" stroke="#C9A84C" strokeWidth="1" />
          <circle cx="200" cy="200" r="150" stroke="#C9A84C" strokeWidth="0.5" />
          <circle cx="200" cy="200" r="120" stroke="#C9A84C" strokeWidth="0.5" />
        </svg>
        {/* paisley-inspired dots */}
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="absolute h-1 w-1 rounded-full bg-yellow-300 opacity-20"
            style={{
              left: `${(i * 37 + 10) % 95}%`,
              top: `${(i * 53 + 5) % 90}%`,
            }}
          />
        ))}
      </div>

      {/* Gold top divider */}
      <div className="mb-10 flex items-center gap-3">
        <div className="h-px w-16 bg-gradient-to-r from-transparent to-yellow-400" />
        <Sparkles className="h-4 w-4 text-yellow-400" />
        <div className="h-px w-16 bg-gradient-to-l from-transparent to-yellow-400" />
      </div>

      {/* Shop logo / initials */}
      <div
        className="mb-6 flex h-28 w-28 items-center justify-center rounded-full border-2 border-yellow-400/60 shadow-2xl"
        style={{
          background: 'radial-gradient(circle at 35% 35%, #c9a84c, #8b6914)',
        }}
      >
        <span className="text-4xl font-bold tracking-widest text-white drop-shadow-lg">{initials}</span>
      </div>

      {/* Shop name */}
      <h1 className="px-8 text-center text-3xl font-bold uppercase tracking-[0.15em] text-white drop-shadow-md sm:text-4xl">
        {shopName}
      </h1>

      {/* Tagline */}
      <p className="mt-3 text-center text-sm font-light tracking-widest text-yellow-300/80 uppercase">
        Crafted with elegance · Est. tradition
      </p>

      {/* Gold bottom divider */}
      <div className="mt-10 flex items-center gap-3">
        <div className="h-px w-16 bg-gradient-to-r from-transparent to-yellow-400" />
        <Sparkles className="h-4 w-4 text-yellow-400" />
        <div className="h-px w-16 bg-gradient-to-l from-transparent to-yellow-400" />
      </div>

      {/* Enter button */}
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
          <span className={`font-bold text-brand-700 ${large ? 'text-2xl' : 'text-base'}`}>
            {formatPrice(final)}
          </span>
          <span
            className="rounded-full bg-green-100 px-1.5 py-0.5 text-xs font-semibold text-green-700"
          >
            {Math.round(discountPercent)}% off
          </span>
        </div>
        <span className={`text-neutral-400 line-through ${large ? 'text-sm' : 'text-xs'}`}>
          {formatPrice(price)}
        </span>
      </div>
    );
  }

  return (
    <span className={`font-semibold text-neutral-900 ${large ? 'text-2xl' : 'text-base'}`}>
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

function ProductCard({ product, slug }: { product: PublicProductListItem; slug: string }) {
  const unavailable = product.status !== 'AVAILABLE';

  return (
    <Link
      to={`/shop/${slug}/product/${product.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
      style={{ border: '1px solid rgba(139,26,26,0.08)' }}
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-t-2xl bg-neutral-100">
        <ProductImage
          src={product.primary_image_url}
          alt={product.name}
          className={`h-full w-full transition-transform duration-500 group-hover:scale-105 ${unavailable ? 'opacity-70 grayscale-[30%]' : ''}`}
        />
        <StatusBadge status={product.status} />

        {product.discount_percent ? (
          <div className="absolute right-2 top-2 rounded-full bg-brand-600 px-2 py-0.5 text-xs font-bold text-white shadow">
            -{Math.round(product.discount_percent)}%
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-3">
        <p className="line-clamp-2 text-sm font-medium leading-snug text-neutral-800">
          {product.name}
        </p>
        <p className="mt-0.5 text-xs text-neutral-400">{product.category.name}</p>
        <div className="mt-auto pt-2">
          <PriceDisplay price={product.price} discountPercent={product.discount_percent} />
        </div>
        {product.quantity_available <= 3 && product.quantity_available > 0 && product.status === 'AVAILABLE' && (
          <p className="mt-1 text-xs font-medium text-amber-600">
            Only {product.quantity_available} left!
          </p>
        )}
      </div>
    </Link>
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
        style={{ background: 'rgba(74,10,20,0.95)', backdropFilter: 'blur(12px)' }}
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

  const [showSplash, setShowSplash] = useState(true);
  const [activeTab, setActiveTab] = useState<NavTab>('catalog');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [sort, setSort] = useState<SortOption>('newest');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // When user taps "Search" tab, focus the search box
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

  const {
    data: productPages,
    isLoading: productsLoading,
    isError: productsIsError,
    refetch: refetchProducts,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['public', 'products', slug, { categoryId, search, sort }],
    queryFn: ({ pageParam }) =>
      listShopProducts(slug, {
        categoryId: categoryId || undefined,
        search: search || undefined,
        sort,
        page: pageParam,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.has_more ? lastPage.page + 1 : undefined),
    enabled: Boolean(slug) && Boolean(catalog),
  });

  if (shopLoading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #4a0a14, #8B1A1A)' }}
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

  const products = productPages?.pages.flatMap((page) => page.items) ?? [];
  const total = productPages?.pages[0]?.total ?? 0;
  const hasFilters = Boolean(search || categoryId);
  const { shop, categories } = catalog;

  return (
    <>
      {/* Splash screen */}
      {showSplash && <WelcomeSplash shopName={shop.name} onEnter={() => setShowSplash(false)} />}

      <div
        className="min-h-screen pb-24 sm:pb-8"
        style={{ background: 'linear-gradient(180deg, #fdf8f4 0%, #faf5f0 100%)' }}
      >
        {/* ── Header ── */}
        <header
          className="relative overflow-hidden px-4 pb-6 pt-8 sm:px-6"
          style={{
            background: 'linear-gradient(135deg, #4a0a14 0%, #8B1A1A 60%, #6b1520 100%)',
          }}
        >
          {/* Decorative arcs */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <svg className="absolute -right-10 -top-10 h-48 w-48 opacity-10" viewBox="0 0 200 200" fill="none">
              <circle cx="200" cy="0" r="160" stroke="#C9A84C" strokeWidth="1" />
              <circle cx="200" cy="0" r="130" stroke="#C9A84C" strokeWidth="0.5" />
            </svg>
          </div>

          <div className="relative mx-auto max-w-5xl">
            <div className="flex items-center gap-4">
              {/* Logo */}
              {shop.logo_url ? (
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border-2 border-yellow-400/40 shadow-lg">
                  <img src={shop.logo_url} alt={shop.name} className="h-full w-full object-cover" />
                </div>
              ) : (
                <div
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-2 border-yellow-400/40 shadow-lg"
                  style={{ background: 'radial-gradient(circle at 35% 35%, #c9a84c, #8b6914)' }}
                >
                  <span className="text-xl font-bold tracking-wider text-white">
                    {shopInitials(shop.name)}
                  </span>
                </div>
              )}

              <div className="min-w-0">
                <h1 className="truncate text-xl font-bold uppercase tracking-wide text-white sm:text-2xl">
                  {shop.name}
                </h1>
                {shop.city && (
                  <p className="mt-0.5 text-xs font-medium tracking-widest text-yellow-300/70 uppercase">
                    {shop.city}
                  </p>
                )}
              </div>
            </div>

            {shop.description && (
              <p className="mt-3 text-sm leading-relaxed text-white/70">{shop.description}</p>
            )}

            {shop.phone && (
              <a
                href={`tel:${shop.phone}`}
                className="mt-3 inline-flex items-center gap-1.5 text-xs text-yellow-300/80 hover:text-yellow-200"
              >
                <Phone className="h-3.5 w-3.5" />
                {shop.phone}
              </a>
            )}
          </div>

          {/* Gold bottom accent */}
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-yellow-400/60 to-transparent" />
        </header>

        {/* ── Category circles ── */}
        {categories.length > 0 && (
          <div className="mx-auto max-w-5xl px-4 pt-5 sm:px-6">
            <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-2">
              <button
                type="button"
                onClick={() => setCategoryId('')}
                className="flex shrink-0 flex-col items-center gap-1.5"
              >
                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-full text-xs font-bold transition-all ${
                    categoryId === ''
                      ? 'scale-110 shadow-lg text-white'
                      : 'bg-white text-brand-700 shadow-sm hover:shadow-md'
                  }`}
                  style={
                    categoryId === ''
                      ? { background: 'linear-gradient(135deg, #8B1A1A, #c9a84c)' }
                      : { border: '2px solid rgba(139,26,26,0.15)' }
                  }
                >
                  All
                </div>
                <span className={`text-xs font-medium ${categoryId === '' ? 'text-brand-700' : 'text-neutral-500'}`}>
                  All
                </span>
              </button>

              {categories.map((cat) => {
                const active = categoryId === cat.id;
                const initial = cat.name[0]?.toUpperCase() ?? '?';
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategoryId(active ? '' : cat.id)}
                    className="flex shrink-0 flex-col items-center gap-1.5"
                  >
                    <div
                      className={`flex h-14 w-14 items-center justify-center rounded-full text-sm font-bold transition-all ${
                        active ? 'scale-110 text-white shadow-lg' : 'bg-white text-brand-700 shadow-sm hover:shadow-md'
                      }`}
                      style={
                        active
                          ? { background: 'linear-gradient(135deg, #8B1A1A, #c9a84c)' }
                          : { border: '2px solid rgba(139,26,26,0.15)' }
                      }
                    >
                      {initial}
                    </div>
                    <span
                      className={`max-w-[60px] text-center text-xs font-medium leading-tight ${
                        active ? 'text-brand-700' : 'text-neutral-500'
                      }`}
                    >
                      {cat.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Search + sort bar ── */}
        <div
          className="sticky top-0 z-20 border-b px-4 py-3 sm:px-6"
          style={{
            background: 'rgba(253,248,244,0.96)',
            backdropFilter: 'blur(12px)',
            borderColor: 'rgba(139,26,26,0.1)',
          }}
        >
          <div className="mx-auto flex max-w-5xl items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
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
                placeholder="Search sarees, fabrics…"
                className="w-full rounded-full border py-2.5 pl-9 pr-4 text-sm focus:outline-none focus:ring-2"
                style={{
                  borderColor: 'rgba(139,26,26,0.2)',
                  background: 'white',
                  // @ts-ignore
                  '--tw-ring-color': '#8B1A1A',
                }}
              />
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              className="hidden rounded-full border px-3 py-2 text-xs font-medium sm:block focus:outline-none"
              style={{ borderColor: 'rgba(139,26,26,0.2)', color: '#8B1A1A' }}
              aria-label="Sort products"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Product grid ── */}
        <main className="mx-auto max-w-5xl px-4 pt-4 sm:px-6">
          {/* Mobile sort */}
          <div className="mb-3 flex items-center justify-between sm:hidden">
            <p className="text-xs text-neutral-400">
              {total > 0 ? `${total} item${total === 1 ? '' : 's'}` : ''}
            </p>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              className="rounded-full border px-3 py-1.5 text-xs font-medium focus:outline-none"
              style={{ borderColor: 'rgba(139,26,26,0.2)', color: '#8B1A1A' }}
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
              <p className="text-sm text-neutral-500">Could not load products right now.</p>
              <button
                type="button"
                onClick={() => refetchProducts()}
                className="mt-3 rounded-full px-4 py-1.5 text-sm font-medium text-brand-600 underline"
              >
                Try again
              </button>
            </div>
          )}

          {!productsLoading && !productsIsError && products.length === 0 && !hasFilters && (
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-neutral-200 bg-white px-6 py-16 text-center">
              <Package className="h-8 w-8 text-neutral-300" />
              <p className="mt-3 text-sm font-medium text-neutral-700">No products yet</p>
              <p className="mt-1 text-xs text-neutral-400">
                This shop hasn't added any products to their catalog yet.
              </p>
            </div>
          )}

          {!productsLoading && !productsIsError && products.length === 0 && hasFilters && (
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-neutral-200 bg-white px-6 py-16 text-center">
              <Search className="h-8 w-8 text-neutral-300" />
              <p className="mt-3 text-sm font-medium text-neutral-700">No products found</p>
              <button
                type="button"
                onClick={() => { setSearchInput(''); setCategoryId(''); }}
                className="mt-3 rounded-full bg-brand-600 px-4 py-1.5 text-xs font-medium text-white"
              >
                Clear filters
              </button>
            </div>
          )}

          {products.length > 0 && (
            <>
              <p className="mb-3 hidden text-xs text-neutral-400 sm:block">
                {total} item{total === 1 ? '' : 's'}
              </p>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} slug={slug} />
                ))}
              </div>

              {hasNextPage && (
                <div className="flex justify-center py-8">
                  <button
                    type="button"
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                    className="rounded-full border px-6 py-2.5 text-sm font-medium transition-colors disabled:opacity-60"
                    style={{ borderColor: 'rgba(139,26,26,0.3)', color: '#8B1A1A' }}
                  >
                    {isFetchingNextPage ? 'Loading…' : 'Load more'}
                  </button>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Pinterest-style bottom nav (mobile only) */}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} shopPhone={shop.phone} />
    </>
  );
}
