/**
 * Shop-owner analytics. Built on the shared chart layer
 * (@/components/charts) — analytical blue palette, thin marks, one
 * consistent tooltip, light + dark selected per surface.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { Eye, Heart, ImageOff, Package, Search, ShoppingBag, Tags, TrendingUp, Users } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { getRichAnalytics } from '@/services/shopOwner';
import { getApiErrorMessage } from '@/utils/apiError';
import ErrorState from '@/components/ErrorState';
import Spinner from '@/components/Spinner';
import { BarSeries, BreakdownBars, ChartCard, KpiTile, TrendArea } from '@/components/charts';
import type { RichAnalytics } from '@/types/dashboard';

type Period = 'today' | '7d' | '30d' | '3m' | '1y';

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: '3m', label: '3 Months' },
  { value: '1y', label: '1 Year' },
];

const PERIOD_LABELS: Record<Period, string> = {
  today: 'vs yesterday',
  '7d': 'vs prev 7 days',
  '30d': 'vs prev 30 days',
  '3m': 'vs prev 3 months',
  '1y': 'vs prev year',
};

function fmt(n: number): string {
  return n.toLocaleString('en-IN');
}

function fmtBucket(iso: string, period: Period): string {
  try {
    const d = parseISO(iso);
    if (period === 'today') return format(d, 'HH:mm');
    if (period === '1y') return format(d, 'MMM');
    return format(d, 'MMM d');
  } catch {
    return iso;
  }
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">{children}</p>
  );
}

function ProductImage({ url, name }: { url: string | null; name: string }) {
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-neutral-100 dark:bg-neutral-800">
      {url ? (
        <img src={url} alt={name} className="h-full w-full object-cover" />
      ) : (
        <ImageOff className="h-3.5 w-3.5 text-neutral-300 dark:text-neutral-600" />
      )}
    </div>
  );
}

function EmptyRow({ message }: { message: string }) {
  return <p className="py-4 text-sm text-neutral-400">{message}</p>;
}

interface TopProductRow {
  product_id: number;
  name: string;
  primary_image_url: string | null;
  category_name: string | null;
  count: number;
}

function TopProductList({
  rows,
  unit,
  emptyMessage,
}: {
  rows: TopProductRow[];
  unit: string;
  emptyMessage: string;
}) {
  if (rows.length === 0) return <EmptyRow message={emptyMessage} />;
  return (
    <ul className="mt-3 divide-y divide-neutral-100 dark:divide-neutral-800">
      {rows.map((p, i) => (
        <li key={p.product_id} className="flex items-center gap-3 py-2.5">
          <span className="w-5 shrink-0 text-xs font-medium tabular-nums text-neutral-400">{i + 1}</span>
          <ProductImage url={p.primary_image_url} name={p.name} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-neutral-800 dark:text-neutral-200">{p.name}</p>
            {p.category_name && <p className="truncate text-xs text-neutral-400">{p.category_name}</p>}
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
              {fmt(p.count)}
            </p>
            <p className="text-[10px] text-neutral-400">{unit}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function PeriodSelector({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <div className="flex gap-1 rounded-lg border border-neutral-200 bg-neutral-50 p-1 dark:border-neutral-800 dark:bg-neutral-900">
      {PERIOD_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            value === opt.value
              ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
              : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const { shop } = useAuth();
  const shopId = shop?.id;
  const [period, setPeriod] = useState<Period>('7d');
  const [productTab, setProductTab] = useState<'viewed' | 'sold' | 'selected'>('viewed');

  const { data, isLoading, isError, error, refetch } = useQuery<RichAnalytics>({
    queryKey: ['shop-owner', 'analytics', 'rich', shopId, period],
    queryFn: () => getRichAnalytics(shopId as number, period),
    enabled: Number.isFinite(shopId),
    staleTime: 60_000,
  });

  const hasData =
    data &&
    (data.visits.current > 0 ||
      data.products_sold.current > 0 ||
      data.selection_adds.current > 0 ||
      data.top_viewed_products.length > 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Analytics</h1>
          <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
            How customers are browsing {shop?.name ?? 'your catalog'}
          </p>
        </div>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {isLoading && (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      )}

      {isError && <ErrorState message={getApiErrorMessage(error)} onRetry={() => refetch()} />}

      {data && !hasData && (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-neutral-200 bg-white px-6 py-16 text-center dark:border-neutral-800 dark:bg-neutral-900">
          <TrendingUp className="h-8 w-8 text-neutral-300 dark:text-neutral-600" />
          <p className="mt-3 text-sm font-medium text-neutral-700 dark:text-neutral-300">
            No activity in this period
          </p>
          <p className="mt-1 max-w-xs text-sm text-neutral-400">
            Once customers start scanning your QR code and browsing the catalog, their data will
            appear here.
          </p>
        </div>
      )}

      {data && hasData && (
        <div className="space-y-8">
          <section>
            <SectionLabel>Overview</SectionLabel>
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
              <KpiTile
                label="Customer Visits"
                icon={Eye}
                value={fmt(data.visits.current)}
                change={deltaOrNull(data.visits)}
                previousLabel={PERIOD_LABELS[period]}
                spark={data.visits_series.map((s) => s.visits)}
              />
              <KpiTile
                label="Unique Visitors"
                icon={Users}
                value={fmt(data.unique_visitors.current)}
                change={deltaOrNull(data.unique_visitors)}
                previousLabel={PERIOD_LABELS[period]}
                spark={data.visits_series.map((s) => s.unique_visitors)}
              />
              <KpiTile
                label="Product Views"
                icon={ShoppingBag}
                value={fmt(data.product_views.current)}
                change={deltaOrNull(data.product_views)}
                previousLabel={PERIOD_LABELS[period]}
              />
              <KpiTile
                label="Products Sold"
                icon={Package}
                value={fmt(data.products_sold.current)}
                change={deltaOrNull(data.products_sold)}
                previousLabel={PERIOD_LABELS[period]}
                spark={data.sales_series.map((s) => s.sold)}
              />
              <KpiTile
                label="Saved to My Choice"
                icon={Heart}
                value={fmt(data.selection_adds.current)}
                change={deltaOrNull(data.selection_adds)}
                previousLabel={PERIOD_LABELS[period]}
              />
            </div>
          </section>

          <ChartCard
            title="Customer Visits"
            subtitle={`${fmt(data.visits.current)} total · ${data.avg_visits_per_day}/day avg · ${fmt(
              data.unique_visitors.current,
            )} unique`}
            empty={data.visits_series.length === 0}
            emptyLabel="No visit data for this period"
          >
            <TrendArea
              data={data.visits_series.map((s) => ({
                label: fmtBucket(s.bucket, period),
                visits: s.visits,
                unique: s.unique_visitors,
              }))}
              series={[
                { key: 'visits', name: 'Visits' },
                { key: 'unique', name: 'Unique visitors' },
              ]}
            />
          </ChartCard>

          <ChartCard
            title="Product Sales"
            subtitle={`${fmt(data.products_sold.current)} sold in this period`}
            empty={data.sales_series.length === 0}
            emptyLabel="No sales recorded — mark products as Sold to track this"
          >
            <BarSeries
              data={data.sales_series.map((s) => ({ label: fmtBucket(s.bucket, period), sold: s.sold }))}
              dataKey="sold"
              name="Sold"
            />
          </ChartCard>

          {data.category_stats.length > 0 && (
            <ChartCard title="Category Interest" subtitle="Views per category in this period">
              <BreakdownBars
                rows={data.category_stats.map((c) => ({
                  label: c.name,
                  value: c.views,
                  meta: c.sold > 0 ? `${c.sold} sold` : undefined,
                }))}
              />
            </ChartCard>
          )}

          <section className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
            <div className="flex items-center justify-between">
              <SectionLabel>Top Products</SectionLabel>
              <div className="flex gap-1 rounded-lg border border-neutral-200 bg-neutral-50 p-1 text-xs dark:border-neutral-800 dark:bg-neutral-900">
                {(['viewed', 'sold', 'selected'] as const).map((tabKey) => (
                  <button
                    key={tabKey}
                    type="button"
                    onClick={() => setProductTab(tabKey)}
                    className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                      productTab === tabKey
                        ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                        : 'text-neutral-500 hover:text-neutral-700'
                    }`}
                  >
                    {tabKey === 'viewed' ? 'Most Viewed' : tabKey === 'sold' ? 'Most Sold' : 'Most Chosen'}
                  </button>
                ))}
              </div>
            </div>

            {productTab === 'viewed' && (
              <TopProductList
                rows={data.top_viewed_products.map((p) => ({ ...p, count: p.view_count }))}
                unit="views"
                emptyMessage="No product views in this period."
              />
            )}
            {productTab === 'sold' && (
              <TopProductList
                rows={data.top_sold_products.map((p) => ({ ...p, count: p.sold_count }))}
                unit="sold"
                emptyMessage="No sales recorded in this period. Mark products as Sold to track this."
              />
            )}
            {productTab === 'selected' && (
              <TopProductList
                rows={data.top_selected_products.map((p) => ({ ...p, count: p.add_count }))}
                unit="adds"
                emptyMessage="No products saved to a customer's My Choice in this period."
              />
            )}
          </section>

          {data.category_stats.length > 0 && (
            <section className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
              <SectionLabel>Category Performance</SectionLabel>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-100 dark:border-neutral-800">
                      <th className="pb-2 text-left text-xs font-medium text-neutral-400">Category</th>
                      <th className="pb-2 text-right text-xs font-medium text-neutral-400">Views</th>
                      <th className="pb-2 text-right text-xs font-medium text-neutral-400">Visitors</th>
                      <th className="pb-2 text-right text-xs font-medium text-neutral-400">Sold</th>
                      <th className="pb-2 text-right text-xs font-medium text-neutral-400">Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50 dark:divide-neutral-800">
                    {data.category_stats.map((cat) => (
                      <tr key={cat.category_id}>
                        <td className="py-2.5 pr-4">
                          <div className="flex items-center gap-2">
                            <Tags className="h-3.5 w-3.5 shrink-0 text-neutral-300 dark:text-neutral-600" />
                            <span className="font-medium text-neutral-800 dark:text-neutral-200">
                              {cat.name}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 text-right font-medium tabular-nums text-neutral-900 dark:text-neutral-100">
                          {fmt(cat.views)}
                        </td>
                        <td className="py-2.5 text-right tabular-nums text-neutral-600 dark:text-neutral-400">
                          {fmt(cat.unique_visitors)}
                        </td>
                        <td className="py-2.5 text-right font-medium tabular-nums text-neutral-900 dark:text-neutral-100">
                          {fmt(cat.sold)}
                        </td>
                        <td className="py-2.5 text-right tabular-nums text-neutral-500">
                          {cat.sold > 0 ? `${cat.sales_share}%` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
            <div className="flex items-center gap-2">
              <Search className="h-3.5 w-3.5 text-neutral-400" />
              <SectionLabel>Search Insights</SectionLabel>
            </div>
            <p className="mt-0.5 text-xs text-neutral-400">Terms customers searched · min 3 characters</p>
            {data.search_insights.length === 0 ? (
              <EmptyRow message="No searches in this period." />
            ) : (
              <div className="mt-3">
                <BreakdownBars
                  rows={data.search_insights.map((s) => ({ label: s.term, value: s.count }))}
                  valueSuffix=""
                />
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

/** A percentage change is only meaningful when there was a prior period to
 *  compare against; otherwise the KPI tile shows the number alone. */
function deltaOrNull(kpi: { change: number; previous: number; current: number }): number | null {
  if (kpi.previous === 0) return null;
  return kpi.change;
}
