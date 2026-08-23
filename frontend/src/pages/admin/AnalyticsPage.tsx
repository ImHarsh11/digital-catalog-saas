/**
 * Analytics page — Phase 7 redesign.
 *
 * Design language: premium monochrome. Black / white / neutral grays only.
 * Positive/negative delta: arrows + typography weight, never bright green/red.
 * Charts: Recharts with thin lines, subtle grid, neutral palette.
 */

import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import {
  ArrowDown,
  ArrowUp,
  Eye,
  ImageOff,
  Minus,
  Package,
  Search,
  ShoppingBag,
  Tags,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '@/hooks/useAuth';
import { getRichAnalytics } from '@/services/shopOwner';
import { getApiErrorMessage } from '@/utils/apiError';
import ErrorState from '@/components/ErrorState';
import Spinner from '@/components/Spinner';
import type { PeriodKPI, RichAnalytics, TimeSeriesSale, TimeSeriesVisit } from '@/types/dashboard';
import { useEffect, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Period = 'today' | '7d' | '30d' | '3m' | '1y';

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: '3m', label: '3 Months' },
  { value: '1y', label: '1 Year' },
];

const PERIOD_LABELS: Record<Period, string> = {
  today: 'yesterday',
  '7d': 'prev 7 days',
  '30d': 'prev 30 days',
  '3m': 'prev 3 months',
  '1y': 'prev year',
};

// ─── Dark-mode hook ───────────────────────────────────────────────────────────

/**
 * Returns true when the <html> element carries the `dark` class.
 * Updates reactively whenever the class changes (theme toggle or system change).
 */
function useDark(): boolean {
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains('dark')
  );
  useEffect(() => {
    const el = document.documentElement;
    const obs = new MutationObserver(() => {
      setDark(el.classList.contains('dark'));
    });
    obs.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString('en-IN');
}

function fmtBucket(iso: string, period: Period): string {
  try {
    const d = parseISO(iso);
    if (period === 'today') return format(d, 'HH:mm');
    if (period === '1y') return format(d, 'MMM');
    if (period === '3m') return format(d, 'MMM d');
    return format(d, 'MMM d');
  } catch {
    return iso;
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
      {children}
    </p>
  );
}

function DeltaChip({ kpi }: { kpi: PeriodKPI }) {
  const { change, previous, current } = kpi;

  // No prior period data → show "New" instead of a meaningless percentage
  if (previous === 0 && current > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-neutral-100 px-1.5 py-0.5 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
        New
      </span>
    );
  }
  if (change === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-neutral-400">
        <Minus className="h-3 w-3" />
        0%
      </span>
    );
  }
  const up = change > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium ${
        up ? 'text-neutral-700 dark:text-neutral-300' : 'text-neutral-500 dark:text-neutral-400'
      }`}
    >
      {up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {Math.abs(change)}%
    </span>
  );
}

function KPICard({
  label,
  icon: Icon,
  kpi,
  period,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  kpi: PeriodKPI;
  period: Period;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center gap-2 text-neutral-400 dark:text-neutral-500">
        <Icon className="h-3.5 w-3.5" />
        <SectionLabel>{label}</SectionLabel>
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
        {fmt(kpi.current)}
      </p>
      <div className="mt-1.5 flex items-center gap-2">
        <DeltaChip kpi={kpi} />
        <span className="text-xs text-neutral-400 dark:text-neutral-500">
          vs {PERIOD_LABELS[period]}
        </span>
      </div>
      <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
        Prev: {fmt(kpi.previous)}
      </p>
    </div>
  );
}

function ChartTooltipContent({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number; name: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 shadow-sm dark:border-neutral-700 dark:bg-neutral-800">
      {label && <p className="mb-1 text-xs text-neutral-400">{label}</p>}
      {payload.map((p) => (
        <p key={p.name} className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
          {fmt(p.value)}
          {p.name === 'unique_visitors' && (
            <span className="ml-1 text-xs font-normal text-neutral-400"> unique</span>
          )}
        </p>
      ))}
    </div>
  );
}

function VisitsChart({ series, period }: { series: TimeSeriesVisit[]; period: Period }) {
  const dark = useDark();
  // Monochrome palette that stays legible in both themes
  const line = dark ? '#f5f5f5' : '#171717';      // neutral-100 / neutral-900
  const grid = dark ? '#404040' : '#e5e7eb';      // neutral-700 / neutral-200
  const tick = dark ? '#737373' : '#9ca3af';      // neutral-500 / neutral-400

  const data = series.map((s) => ({
    bucket: fmtBucket(s.bucket, period),
    visits: s.visits,
    unique_visitors: s.unique_visitors,
  }));

  if (!data.length) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-neutral-400">
        No visit data for this period
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="visitsGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={line} stopOpacity={0.12} />
            <stop offset="95%" stopColor={line} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={grid} strokeOpacity={0.6} />
        <XAxis
          dataKey="bucket"
          tick={{ fontSize: 10, fill: tick }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 10, fill: tick }}
          axisLine={false}
          tickLine={false}
          width={36}
          allowDecimals={false}
        />
        <Tooltip content={<ChartTooltipContent />} />
        <Area
          type="monotone"
          dataKey="visits"
          stroke={line}
          strokeWidth={1.5}
          fill="url(#visitsGrad)"
          dot={false}
          activeDot={{ r: 3, fill: line }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function SalesChart({ series, period }: { series: TimeSeriesSale[]; period: Period }) {
  const dark = useDark();
  const bar  = dark ? '#f5f5f5' : '#171717';
  const grid = dark ? '#404040' : '#e5e7eb';
  const tick = dark ? '#737373' : '#9ca3af';

  const data = series.map((s) => ({
    bucket: fmtBucket(s.bucket, period),
    sold: s.sold,
  }));

  if (!data.length) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-neutral-400">
        No sales data for this period
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={grid} strokeOpacity={0.6} vertical={false} />
        <XAxis
          dataKey="bucket"
          tick={{ fontSize: 10, fill: tick }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 10, fill: tick }}
          axisLine={false}
          tickLine={false}
          width={36}
          allowDecimals={false}
        />
        <Tooltip content={<ChartTooltipContent />} />
        <Bar dataKey="sold" fill={bar} radius={[2, 2, 0, 0]} maxBarSize={32} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function ComparisonStat({
  label,
  kpi,
}: {
  label: string;
  kpi: PeriodKPI;
}) {
  const up = kpi.change > 0;
  const neutral = kpi.change === 0;
  return (
    <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
      <p className="text-xs text-neutral-500 dark:text-neutral-400">{label}</p>
      <div className="mt-1 flex items-end justify-between gap-2">
        <p className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
          {fmt(kpi.current)}
        </p>
        {!neutral && (
          <span
            className={`flex items-center gap-0.5 text-sm font-medium ${
              up ? 'text-neutral-800 dark:text-neutral-200' : 'text-neutral-500'
            }`}
          >
            {up ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
            {Math.abs(kpi.change)}%
          </span>
        )}
      </div>
      <p className="mt-0.5 text-xs text-neutral-400">
        Prev: {fmt(kpi.previous)} · {kpi.change >= 0 ? '+' : ''}
        {fmt(kpi.current - kpi.previous)}
      </p>
    </div>
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

// ─── Period selector ──────────────────────────────────────────────────────────

function PeriodSelector({
  value,
  onChange,
}: {
  value: Period;
  onChange: (p: Period) => void;
}) {
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

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { shop } = useAuth();
  const shopId = shop?.id;
  const [period, setPeriod] = useState<Period>('7d');
  const [productTab, setProductTab] = useState<'viewed' | 'sold'>('viewed');

  const { data, isLoading, isError, error, refetch } = useQuery<RichAnalytics>({
    queryKey: ['shop-owner', 'analytics', 'rich', shopId, period],
    queryFn: () => getRichAnalytics(shopId as number, period),
    enabled: Number.isFinite(shopId),
    staleTime: 60_000, // 1 min — analytics data doesn't need real-time refresh
  });

  const hasData =
    data &&
    (data.visits.current > 0 ||
      data.products_sold.current > 0 ||
      data.top_viewed_products.length > 0);

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Analytics</h1>
          <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
            How customers are browsing {shop?.name ?? 'your catalog'}
          </p>
        </div>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {/* ── Loading ── */}
      {isLoading && (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      )}

      {/* ── Error ── */}
      {isError && (
        <ErrorState message={getApiErrorMessage(error)} onRetry={() => refetch()} />
      )}

      {/* ── Empty state ── */}
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

      {/* ── Dashboard ── */}
      {data && hasData && (
        <div className="space-y-8">

          {/* ══ A. KPI cards ══ */}
          <section>
            <SectionLabel>Overview</SectionLabel>
            <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <KPICard label="Customer Visits" icon={Eye} kpi={data.visits} period={period} />
              <KPICard label="Unique Visitors" icon={Users} kpi={data.unique_visitors} period={period} />
              <KPICard label="Product Views" icon={ShoppingBag} kpi={data.product_views} period={period} />
              <KPICard label="Products Sold" icon={Package} kpi={data.products_sold} period={period} />
            </div>
          </section>

          {/* ══ B. Customer Visits ══ */}
          <section className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <SectionLabel>Customer Visits</SectionLabel>
                <p className="mt-1 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
                  {fmt(data.visits.current)}
                </p>
              </div>
              <div className="flex gap-6">
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wider text-neutral-400">Avg / day</p>
                  <p className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                    {data.avg_visits_per_day}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wider text-neutral-400">Unique</p>
                  <p className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                    {fmt(data.unique_visitors.current)}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5">
              <VisitsChart series={data.visits_series} period={period} />
            </div>
          </section>

          {/* ══ C. Visit + Sales comparison row ══ */}
          <section>
            <SectionLabel>Period Comparison</SectionLabel>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <ComparisonStat label="Visits" kpi={data.visits} />
              <ComparisonStat label="Unique Visitors" kpi={data.unique_visitors} />
              <ComparisonStat label="Product Views" kpi={data.product_views} />
              <ComparisonStat label="Products Sold" kpi={data.products_sold} />
            </div>
          </section>

          {/* ══ D. Product Sales ══ */}
          <section className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <SectionLabel>Product Sales</SectionLabel>
                <p className="mt-1 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
                  {fmt(data.products_sold.current)}{' '}
                  <span className="text-sm font-normal text-neutral-400">sold</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <DeltaChip kpi={data.products_sold} />
                <span className="text-xs text-neutral-400">vs {PERIOD_LABELS[period]}</span>
              </div>
            </div>
            <div className="mt-5">
              <SalesChart series={data.sales_series} period={period} />
            </div>
          </section>

          {/* ══ E. Top Products ══ */}
          <section className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
            <div className="flex items-center justify-between">
              <SectionLabel>Top Products</SectionLabel>
              <div className="flex gap-1 rounded-lg border border-neutral-200 bg-neutral-50 p-1 text-xs dark:border-neutral-800 dark:bg-neutral-900">
                <button
                  type="button"
                  onClick={() => setProductTab('viewed')}
                  className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                    productTab === 'viewed'
                      ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                      : 'text-neutral-500 hover:text-neutral-700'
                  }`}
                >
                  Most Viewed
                </button>
                <button
                  type="button"
                  onClick={() => setProductTab('sold')}
                  className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                    productTab === 'sold'
                      ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                      : 'text-neutral-500 hover:text-neutral-700'
                  }`}
                >
                  Most Sold
                </button>
              </div>
            </div>

            {productTab === 'viewed' ? (
              data.top_viewed_products.length === 0 ? (
                <EmptyRow message="No product views in this period." />
              ) : (
                <ul className="mt-3 divide-y divide-neutral-100 dark:divide-neutral-800">
                  {data.top_viewed_products.map((p, i) => (
                    <li key={p.product_id} className="flex items-center gap-3 py-2.5">
                      <span className="w-5 shrink-0 text-xs font-medium text-neutral-400">
                        {i + 1}
                      </span>
                      <ProductImage url={p.primary_image_url} name={p.name} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-neutral-800 dark:text-neutral-200">
                          {p.name}
                        </p>
                        {p.category_name && (
                          <p className="truncate text-xs text-neutral-400">{p.category_name}</p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                          {fmt(p.view_count)}
                        </p>
                        <p className="text-[10px] text-neutral-400">views</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )
            ) : data.top_sold_products.length === 0 ? (
              <EmptyRow message="No sales recorded in this period. Mark products as Sold to track this." />
            ) : (
              <ul className="mt-3 divide-y divide-neutral-100 dark:divide-neutral-800">
                {data.top_sold_products.map((p, i) => (
                  <li key={p.product_id} className="flex items-center gap-3 py-2.5">
                    <span className="w-5 shrink-0 text-xs font-medium text-neutral-400">
                      {i + 1}
                    </span>
                    <ProductImage url={p.primary_image_url} name={p.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-neutral-800 dark:text-neutral-200">
                        {p.name}
                      </p>
                      {p.category_name && (
                        <p className="truncate text-xs text-neutral-400">{p.category_name}</p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                        {fmt(p.sold_count)}
                      </p>
                      <p className="text-[10px] text-neutral-400">sold</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ══ F. Category Performance ══ */}
          {data.category_stats.length > 0 && (
            <section className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
              <SectionLabel>Category Performance</SectionLabel>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-100 dark:border-neutral-800">
                      <th className="pb-2 text-left text-xs font-medium text-neutral-400">
                        Category
                      </th>
                      <th className="pb-2 text-right text-xs font-medium text-neutral-400">
                        Views
                      </th>
                      <th className="pb-2 text-right text-xs font-medium text-neutral-400">
                        Visitors
                      </th>
                      <th className="pb-2 text-right text-xs font-medium text-neutral-400">
                        Sold
                      </th>
                      <th className="pb-2 text-right text-xs font-medium text-neutral-400">
                        Share
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50 dark:divide-neutral-800">
                    {data.category_stats.map((cat) => (
                      <tr key={cat.category_id} className="group">
                        <td className="py-2.5 pr-4">
                          <div className="flex items-center gap-2">
                            <Tags className="h-3.5 w-3.5 shrink-0 text-neutral-300 dark:text-neutral-600" />
                            <span className="font-medium text-neutral-800 dark:text-neutral-200">
                              {cat.name}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 text-right font-medium text-neutral-900 dark:text-neutral-100">
                          {fmt(cat.views)}
                        </td>
                        <td className="py-2.5 text-right text-neutral-600 dark:text-neutral-400">
                          {fmt(cat.unique_visitors)}
                        </td>
                        <td className="py-2.5 text-right font-medium text-neutral-900 dark:text-neutral-100">
                          {fmt(cat.sold)}
                        </td>
                        <td className="py-2.5 text-right">
                          <span className="inline-block min-w-[2.5rem] text-right text-neutral-500">
                            {cat.sold > 0 ? `${cat.sales_share}%` : '—'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ══ G. Search Insights ══ */}
          <section className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
            <div className="flex items-center gap-2">
              <Search className="h-3.5 w-3.5 text-neutral-400" />
              <SectionLabel>Search Insights</SectionLabel>
            </div>
            <p className="mt-0.5 text-xs text-neutral-400">
              Terms customers searched · min 3 characters
            </p>
            {data.search_insights.length === 0 ? (
              <EmptyRow message="No searches in this period." />
            ) : (
              <ul className="mt-3 divide-y divide-neutral-100 dark:divide-neutral-800">
                {data.search_insights.map((s, i) => (
                  <li key={s.term} className="flex items-center gap-3 py-2.5">
                    <span className="w-5 shrink-0 text-xs font-medium text-neutral-400">
                      {i + 1}
                    </span>
                    <p className="min-w-0 flex-1 truncate text-sm text-neutral-800 dark:text-neutral-200">
                      {s.term}
                    </p>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                        {fmt(s.count)}
                      </p>
                      <p className="text-[10px] text-neutral-400">searches</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

        </div>
      )}
    </div>
  );
}
