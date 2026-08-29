import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { AlertTriangle, CheckCircle2, IndianRupee, MoonStar, Plus, Store } from 'lucide-react';
import { getDashboardStats } from '@/services/superAdmin';
import { getApiErrorMessage } from '@/utils/apiError';
import Spinner from '@/components/Spinner';
import ErrorState from '@/components/ErrorState';
import Badge from '@/components/Badge';
import { BarSeries, ChartCard } from '@/components/charts';
import type { SuperAdminDashboardStats } from '@/types/dashboard';

const STATUS_ORDER = ['TRIAL', 'ACTIVE', 'PAST_DUE', 'EXPIRED', 'SUSPENDED', 'CANCELLED'];
const STATUS_LABEL: Record<string, string> = {
  TRIAL: 'Trial',
  ACTIVE: 'Active',
  PAST_DUE: 'Past due',
  EXPIRED: 'Expired',
  SUSPENDED: 'Suspended',
  CANCELLED: 'Cancelled',
};

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
          <p className="mt-1 text-sm text-neutral-500">
            Tenant lifecycle and billing across every shop.
          </p>
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

      {data && <DashboardBody data={data} />}
    </div>
  );
}

function DashboardBody({ data }: { data: SuperAdminDashboardStats }) {
  return (
    <div className="mt-6 space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={<Store className="h-4 w-4" />} label="Total Shops" value={data.total_shops} />
        <StatCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Live Catalogs"
          value={data.live_catalogs}
        />
        <StatCard
          icon={<Plus className="h-4 w-4" />}
          label="New This Week"
          value={data.new_shops_this_week}
        />
        <StatCard
          icon={<Plus className="h-4 w-4" />}
          label="New This Month"
          value={data.new_shops_this_month}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-neutral-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-neutral-900">Shops by status</h2>
          <ul className="mt-3 space-y-2">
            {STATUS_ORDER.map((s) => (
              <li key={s} className="flex items-center justify-between text-sm">
                <span className="text-neutral-600">{STATUS_LABEL[s] ?? s}</span>
                <span className="font-semibold tabular-nums text-neutral-900">
                  {data.by_status[s] ?? 0}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <div className="lg:col-span-2">
          <ChartCard
            title="New shops"
            subtitle="Signups per week, last 12 weeks"
            empty={data.signups_series.every((p) => p.count === 0)}
            emptyLabel="No signups in the last 12 weeks"
          >
            <BarSeries
              data={data.signups_series.map((p) => ({
                label: format(parseISO(p.bucket), 'MMM d'),
                count: p.count,
              }))}
              dataKey="count"
              name="New shops"
              height={176}
            />
          </ChartCard>
        </div>
      </div>

      <section className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-5">
        <div className="flex items-center gap-2 text-neutral-500">
          <IndianRupee className="h-4 w-4" />
          <h2 className="text-sm font-semibold">Revenue</h2>
        </div>
        {data.revenue_pending ? (
          <p className="mt-3 text-sm text-neutral-500">
            MRR, revenue, trial&nbsp;&rarr;&nbsp;paid conversion and churn appear here once Razorpay
            billing is connected.
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <MiniStat label="MRR" value={formatMoney(data.mrr)} />
            <MiniStat label="ARR" value={formatMoney(data.arr)} />
            <MiniStat label="This month" value={formatMoney(data.revenue_this_month)} />
            <MiniStat
              label="Trial → Paid"
              value={data.trial_to_paid_rate != null ? `${data.trial_to_paid_rate}%` : '—'}
            />
          </div>
        )}
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <h2 className="text-sm font-semibold text-neutral-900">Trials expiring soon</h2>
        </div>
        {data.trials_expiring_soon.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-400">No trials ending in the next 7 days.</p>
        ) : (
          <ul className="mt-3 divide-y divide-neutral-100">
            {data.trials_expiring_soon.map((t) => (
              <li key={t.shop_id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <Link
                    to={`/super-admin/shops/${t.shop_id}`}
                    className="text-sm font-medium text-neutral-900 hover:text-brand-700"
                  >
                    {t.name}
                  </Link>
                  {t.owner_email && (
                    <p className="truncate text-xs text-neutral-400">{t.owner_email}</p>
                  )}
                </div>
                <Badge tone={t.expired ? 'red' : t.days_remaining <= 3 ? 'amber' : 'green'}>
                  {t.expired
                    ? 'Expired'
                    : t.days_remaining === 1
                      ? '1 day left'
                      : `${t.days_remaining} days left`}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <div className="flex items-center gap-2">
          <MoonStar className="h-4 w-4 text-neutral-400" />
          <h2 className="text-sm font-semibold text-neutral-900">Dormant shops</h2>
          <span className="text-xs text-neutral-400">no catalog edits in 30 days</span>
        </div>
        {data.dormant_shops.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-400">Every live shop has been active recently.</p>
        ) : (
          <ul className="mt-3 divide-y divide-neutral-100">
            {data.dormant_shops.map((d) => (
              <li key={d.shop_id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <Link
                  to={`/super-admin/shops/${d.shop_id}`}
                  className="text-sm font-medium text-neutral-900 hover:text-brand-700"
                >
                  {d.name}
                </Link>
                <span className="text-xs text-neutral-400">
                  {d.last_activity_at
                    ? `last edit ${new Date(d.last_activity_at).toLocaleDateString()}`
                    : 'never edited'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-center gap-2 text-neutral-400">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-neutral-900">{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-neutral-900">{value}</p>
    </div>
  );
}

function formatMoney(value: number | null): string {
  if (value == null) return '—';
  return `₹${value.toLocaleString('en-IN')}`;
}
