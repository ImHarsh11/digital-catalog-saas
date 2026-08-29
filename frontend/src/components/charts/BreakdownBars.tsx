import { useChartTokens } from './tokens';

export interface BreakdownRow {
  label: string;
  value: number;
  /** optional secondary metric shown to the right, e.g. "3 sold" */
  meta?: string;
}

/** Horizontal magnitude bars — for "category interest", "top searches" etc.
 *  Built in plain HTML: a single sequential hue, value labelled at the end,
 *  bars sorted by magnitude by the caller. */
export default function BreakdownBars({
  rows,
  valueSuffix = '',
  max,
}: {
  rows: BreakdownRow[];
  valueSuffix?: string;
  max?: number;
}) {
  const t = useChartTokens();
  const peak = max ?? Math.max(1, ...rows.map((r) => r.value));

  if (rows.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center text-sm text-neutral-400 dark:text-neutral-500">
        Nothing to show yet
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-neutral-700 dark:text-neutral-300">{r.label}</span>
            <span className="shrink-0 tabular-nums text-xs font-semibold text-neutral-900 dark:text-neutral-100">
              {r.value.toLocaleString('en-IN')}
              {valueSuffix}
              {r.meta && <span className="ml-1.5 font-normal text-neutral-400">· {r.meta}</span>}
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-[2px]" style={{ background: t.grid }}>
            <div
              className="h-full rounded-[2px]"
              style={{ width: `${Math.max(4, (r.value / peak) * 100)}%`, background: t.s1 }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
