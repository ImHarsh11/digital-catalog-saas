import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { Globe, MapPin, Package, Phone, Search, Store } from 'lucide-react';
import { getShopCatalog, listShopProducts, type AvailabilityFilter, type SortOption } from '@/services/publicCatalog';
import { customerStatusBadge } from '@/utils/customerProductStatus';
import { formatPrice } from '@/utils/currency';
import ProductImage from '@/components/catalog/ProductImage';
import Spinner from '@/components/Spinner';
import ErrorState from '@/components/ErrorState';
import Badge from '@/components/Badge';
import CatalogUnavailablePage from './CatalogUnavailablePage';

const SORT_OPTIONS: Array<{ value: SortOption; label: string }> = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
];

const AVAILABILITY_OPTIONS: Array<{ value: AvailabilityFilter | ''; label: string }> = [
  { value: '', label: 'All' },
  { value: 'available', label: 'Available' },
  { value: 'unavailable', label: 'Unavailable' },
];

export default function ShopCatalogPage() {
  const { shopSlug } = useParams<{ shopSlug: string }>();
  const slug = shopSlug ?? '';

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [availability, setAvailability] = useState<AvailabilityFilter | ''>('');
  const [sort, setSort] = useState<SortOption>('newest');

  // Small debounce so we're not re-querying on every keystroke -- same
  // pattern as the shop-owner product search (ProductsPage.tsx).
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

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

  const shopUnavailable = shopIsError && shopError instanceof AxiosError && shopError.response?.status === 403;

  const {
    data: productPages,
    isLoading: productsLoading,
    isError: productsIsError,
    refetch: refetchProducts,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['public', 'products', slug, { categoryId, availability, search, sort }],
    queryFn: ({ pageParam }) =>
      listShopProducts(slug, {
        categoryId: categoryId || undefined,
        availability: availability || undefined,
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
      <div className="flex min-h-screen items-center justify-center bg-neutral-50">
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
  const hasFilters = Boolean(search || categoryId || availability);
  const { shop, categories } = catalog;
  const contactLine = [shop.city, shop.phone].filter(Boolean).join(' · ');

  return (
    <div className="min-h-screen bg-neutral-50 pb-16">
      <header className="border-b border-neutral-200 bg-white px-4 pb-5 pt-8 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-neutral-100">
              {shop.logo_url ? (
                <ProductImage src={shop.logo_url} alt={shop.name} className="h-16 w-16" eager />
              ) : (
                <Store className="h-7 w-7 text-neutral-400" />
              )}
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold text-neutral-900">{shop.name}</h1>
              {contactLine && <p className="mt-0.5 truncate text-sm text-neutral-500">{contactLine}</p>}
            </div>
          </div>
          {shop.description && <p className="mt-4 text-sm leading-relaxed text-neutral-600">{shop.description}</p>}
          {(shop.address || shop.phone || shop.website) && (
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-neutral-500">
              {shop.address && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {shop.address}
                </span>
              )}
              {shop.phone && (
                <a href={`tel:${shop.phone}`} className="inline-flex items-center gap-1 hover:text-brand-600">
                  <Phone className="h-3.5 w-3.5" />
                  {shop.phone}
                </a>
              )}
              {shop.website && (
                <a
                  href={shop.website}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 hover:text-brand-600"
                >
                  <Globe className="h-3.5 w-3.5" />
                  Website
                </a>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="sticky top-0 z-10 border-b border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto max-w-5xl space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              type="search"
              inputMode="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search products..."
              className="w-full rounded-full border border-neutral-300 bg-white py-2.5 pl-9 pr-4 text-base focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          {categories.length > 0 && (
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5">
              <button
                type="button"
                onClick={() => setCategoryId('')}
                className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  categoryId === ''
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : 'border-neutral-300 text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                All
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setCategoryId(category.id)}
                  className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                    categoryId === category.id
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : 'border-neutral-300 text-neutral-600 hover:bg-neutral-50'
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex flex-1 rounded-lg border border-neutral-300 p-0.5 text-xs sm:text-sm">
              {AVAILABILITY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setAvailability(option.value)}
                  className={`flex-1 whitespace-nowrap rounded-md py-1.5 font-medium transition-colors ${
                    availability === option.value ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:bg-neutral-50'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              className="w-full rounded-lg border border-neutral-300 px-2.5 py-2 text-sm text-neutral-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 sm:w-auto"
              aria-label="Sort products"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-5xl px-4 pt-5 sm:px-6">
        {productsLoading && (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        )}

        {productsIsError && (
          <ErrorState
            message="Could not load products right now. Please try again."
            onRetry={() => refetchProducts()}
          />
        )}

        {!productsLoading && !productsIsError && products.length === 0 && !hasFilters && (
          <div className="flex flex-col items-center rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-16 text-center">
            <Package className="h-8 w-8 text-neutral-300" />
            <p className="mt-3 text-sm font-medium text-neutral-900">No products yet</p>
            <p className="mt-1 text-sm text-neutral-500">This shop hasn't added any products to their catalog yet.</p>
          </div>
        )}

        {!productsLoading && !productsIsError && products.length === 0 && hasFilters && (
          <div className="flex flex-col items-center rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-16 text-center">
            <Search className="h-8 w-8 text-neutral-300" />
            <p className="mt-3 text-sm font-medium text-neutral-900">No products match your search</p>
            <p className="mt-1 text-sm text-neutral-500">Try a different search term or clear the filters.</p>
          </div>
        )}

        {products.length > 0 && (
          <>
            <p className="pb-3 text-xs text-neutral-400">
              {total} product{total === 1 ? '' : 's'}
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
              {products.map((product) => {
                const badge = customerStatusBadge(product.status);
                const unavailable = product.status !== 'AVAILABLE';
                return (
                  <Link
                    key={product.id}
                    to={`/shop/${slug}/product/${product.id}`}
                    className="group flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white transition-shadow hover:shadow-md"
                  >
                    <div className="relative aspect-[3/4] w-full">
                      <ProductImage
                        src={product.primary_image_url}
                        alt={product.name}
                        className={`h-full w-full ${unavailable ? 'opacity-70' : ''}`}
                      />
                      <div className="absolute left-2 top-2">
                        <Badge tone={badge.tone}>{badge.label}</Badge>
                      </div>
                    </div>
                    <div className="flex flex-1 flex-col p-3">
                      <p className="line-clamp-2 text-sm font-medium text-neutral-900">{product.name}</p>
                      <p className="mt-auto pt-1.5 text-base font-semibold text-neutral-900">
                        {formatPrice(product.price)}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>

            {hasNextPage && (
              <div className="flex justify-center py-8">
                <button
                  type="button"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="rounded-full border border-neutral-300 bg-white px-5 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
                >
                  {isFetchingNextPage ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
