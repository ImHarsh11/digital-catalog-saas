import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CheckCircle2, Clock, Package, Plus, Store, Timer, TrendingUp } from 'lucide-react';
import { getDashboardStats } from '@/services/superAdmin';
import { getApiErrorMessage } from '@/utils/apiError';
import Spinner from '@/components/Spinner';
import ErrorState from '@/components/ErrorState';
import type { SuperAdminDashboardStats } from '@/types/dashboard';
import type { ComponentType } from 'react';

const STAT_CARDS: Array<{
  key: keyof SuperAdminDashboardStats;
  label: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { key: 'total_shops', label: 'Total Shops', icon: Store },
  { key: 'active_shops', label: 'Active Shops', icon: CheckCircle2 },
  { key: 'trial_shops', label: 'Trial Shops', icon: Clock },
  { key: 'expired_trials', label: 'Expired Trials', icon: Timer },
  { key: 'total_products', label: 'Total Products', icon: Package },
  { key: 'products_added_this_week', label: 'Added This Week', icon: TrendingUp },
];

export default function DashboardPage() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['super-admin', 'dashboard'],
    queryFn: getDashboardStats,
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Dashboard</h1>
          <p className="mt-1 text-sm text-neutral-500">An overview of every shop on the platform.</p>
        </div>
        <Link
          to="/super-admin/shops"
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" />
          New Shop
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
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {STAT_CARDS.map(({ key, label, icon: Icon }) => (
            <div key={key} className="rounded-xl border border-neutral-200 bg-white p-4">
              <div className="flex items-center gap-2 text-neutral-400">
                <Icon className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
              </div>
              <p className="mt-2 text-2xl font-semibold text-neutral-900">{data[key]}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
