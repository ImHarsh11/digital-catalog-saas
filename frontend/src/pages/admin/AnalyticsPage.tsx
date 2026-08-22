import { useQuery } from '@tanstack/react-query';
import { BarChart3, Eye, ImageOff, Package, Search, ShoppingBag, Tags } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { getShopAnalytics } from '@/services/shopOwner';
import { getApiErrorMessage } from '@/utils/apiError';
import Spinner from '@/components/Spinner';
import ErrorState from '@/components/ErrorState';
import type { ShopAnalytics } from '@/types/dashboard';
import type { ComponentType } from 'react';

const STAT_CARDS: Array<{
  key: keyof ShopAnalytics;
  subKey: keyof ShopAnalytics;
  label: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { key: 'shop_views_total', subKey: 'shop_views_last_7_days', label: 'Shop Views', icon: Eye },
  { key: 'product_views_total', subKey: 'product_views_last_7_days', label: 'Product Views', icon: ShoppingBag },
  { key: 'searches_total', subKey: 'searches_last_7_days', label: 'Searches', icon: Search },
];

export default function AnalyticsPage() {
  const { shop } = useAuth();
  const shopId = shop?.id;

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['shop-owner', 'analytics', shopId],
    queryFn: () => getShopAnalytics(shopId as number),
    enabled: Number.isFinite(shopId),
  });

  const hasAnyEvents =
    data &&
    (data.shop_views_total > 0 ||
      data.product_views_total > 0 ||
      data.searches_total > 0 ||
      data.top_categories.length > 0);

  return (
    <div>
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Analytics</h1>
        <p className="mt-1 text-sm text-neutral-500">
          How customers are browsing {shop ? shop.name : 'your catalog'} -- pilot stats, updated live.
        </p>
      </div>

      {isLoading && (
        <div className="mt-10 flex justify-center">
          <Spinner />
        </div>
      )}

      {isError && (
        <div className="mt-6">
          <ErrorState message={getApiErrorMessage(error)} onRetry={() => refetch()} />
        </div>
      )}

      {data && !hasAnyEvents && (
        <div className="mt-8 flex flex-col items-center rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100">
            <BarChart3 className="h-6 w-6 text-neutral-400" />
          </div>
          <p className="mt-4 text-sm font-medium text-neutral-900">No activity yet</p>
          <p className="mt-1 max-w-sm text-sm text-neutral-500">
            Once customers start scanning your QR code and browsing the catalog, their views and searches will
            show up here.
          </p>
        </div>
      )}

      {data && hasAnyEvents && (
        <>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {STAT_CARDS.map(({ key, subKey, label, icon: Icon }) => (
              <div key={key} className="rounded-xl border border-neutral-200 bg-white p-4">
                <div className="flex items-center gap-2 text-neutral-400">
                  <Icon className="h-4 w-4" />
                  <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
                </div>
                <p className="mt-2 text-2xl font-semibold text-neutral-900">{data[key] as number}</p>
                <p className="mt-0.5 text-xs text-neutral-500">{data[subKey] as number} in the last 7 days</p>
              </div>
            ))}
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section className="rounded-xl border border-neutral-200 bg-white p-4">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-neutral-900">
                <Package className="h-4 w-4 text-neutral-400" />
                Most-Viewed Products
              </h2>
              {data.top_products.length === 0 ? (
                <p className="mt-3 text-sm text-neutral-500">No product views yet.</p>
              ) : (
                <ul className="mt-3 divide-y divide-neutral-100">
                  {data.top_products.map((product, index) => (
                    <li key={product.product_id} className="flex items-center gap-3 py-2.5">
                      <span className="w-4 shrink-0 text-xs font-medium text-neutral-400">{index + 1}</span>
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-neutral-100">
                        {product.primary_image_url ? (
                          <img
                            src={product.primary_image_url}
                            alt={product.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <ImageOff className="h-4 w-4 text-neutral-300" />
                        )}
                      </div>
                      <p className="min-w-0 flex-1 truncate text-sm text-neutral-800">{product.name}</p>
                      <span className="shrink-0 text-sm font-medium text-neutral-900">{product.view_count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-xl border border-neutral-200 bg-white p-4">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-neutral-900">
                <Search className="h-4 w-4 text-neutral-400" />
                Most-Searched Terms
              </h2>
              {data.top_searches.length === 0 ? (
                <p className="mt-3 text-sm text-neutral-500">No searches yet.</p>
              ) : (
                <ul className="mt-3 divide-y divide-neutral-100">
                  {data.top_searches.map((search, index) => (
                    <li key={search.term} className="flex items-center gap-3 py-2.5">
                      <span className="w-4 shrink-0 text-xs font-medium text-neutral-400">{index + 1}</span>
                      <p className="min-w-0 flex-1 truncate text-sm text-neutral-800">{search.term}</p>
                      <span className="shrink-0 text-sm font-medium text-neutral-900">{search.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-xl border border-neutral-200 bg-white p-4 lg:col-span-2">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-neutral-900">
                <Tags className="h-4 w-4 text-neutral-400" />
                Category Interest
              </h2>
              {data.top_categories.length === 0 ? (
                <p className="mt-3 text-sm text-neutral-500">No category browsing yet.</p>
              ) : (
                <ul className="mt-3 divide-y divide-neutral-100">
                  {data.top_categories.map((category, index) => (
                    <li key={category.category_id} className="flex items-center gap-3 py-2.5">
                      <span className="w-4 shrink-0 text-xs font-medium text-neutral-400">{index + 1}</span>
                      <p className="min-w-0 flex-1 truncate text-sm text-neutral-800">{category.name}</p>
                      <span className="shrink-0 text-sm font-medium text-neutral-900">{category.view_count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
