import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Package, Plus, ShoppingBag, TrendingUp } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { getShopOwnerDashboard } from '@/services/shopOwner';
import { getApiErrorMessage } from '@/utils/apiError';
import { trialBadgeTone } from '@/utils/shopStatus';
import Spinner from '@/components/Spinner';
import ErrorState from '@/components/ErrorState';
import Badge from '@/components/Badge';
import type { ShopOwnerDashboardStats } from '@/types/dashboard';
import type { ComponentType } from 'react';

const STAT_CARDS: Array<{
  key: keyof ShopOwnerDashboardStats;
  label: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { key: 'product_count', label: 'Total Products', icon: Package },
  { key: 'products_available', label: 'Available', icon: CheckCircle2 },
  { key: 'products_sold', label: 'Sold', icon: ShoppingBag },
  { key: 'products_out_of_stock', label: 'Out of Stock', icon: AlertTriangle },
  { key: 'products_added_this_week', label: 'Added This Week', icon: TrendingUp },
];

export default function DashboardPage() {
  const { shop } = useAuth();
  const shopId = shop?.id;

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['shop-owner', 'dashboard', shopId],
    queryFn: () => getShopOwnerDashboard(shopId as number),
    enabled: Number.isFinite(shopId),
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Dashboard</h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {shop ? `An overview of ${shop.name}'s catalog.` : 'An overview of your catalog.'}
          </p>
        </div>
        <Link
          to="/admin/products/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" />
          Add Product
        </Link>
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

      {data && (
        <>
          <div className="mt-4">
            <Badge tone={trialBadgeTone(data.trial_status_label, data.trial_days_remaining)}>
              {data.trial_status_label}
            </Badge>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {STAT_CARDS.map(({ key, label, icon: Icon }) => (
              <div
                key={key}
                className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
              >
                <div className="flex items-center gap-2 text-neutral-400 dark:text-neutral-500">
                  <Icon className="h-4 w-4" />
                  <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
                </div>
                <p className="mt-2 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
                  {data[key] as number}
                </p>
              </div>
            ))}
          </div>

          {data.product_count === 0 && (
            <div className="mt-8 flex flex-col items-center rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-14 text-center dark:border-neutral-700 dark:bg-neutral-900">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
                <Package className="h-6 w-6 text-neutral-400" />
              </div>
              <p className="mt-4 text-sm font-medium text-neutral-900 dark:text-neutral-100">No products yet</p>
              <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                Add your first product to start building your catalog.
              </p>
              <Link
                to="/admin/products/new"
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                <Plus className="h-4 w-4" />
                Add Product
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
