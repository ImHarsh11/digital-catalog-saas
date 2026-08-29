import type { ComponentType, ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import Sparkline from './Sparkline';

interface Props {
  label: string;
  value: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  /** percent change vs the comparison period */
  change?: number | null;
  /** raw previous value, shown as context */
  previousLabel?: string;
  spark?: number[];
  /** for metrics where a decrease is good (rare here) invert the colour */
  invert?: boolean;
}

/** Number-first stat tile with an optional delta chip and sparkline. The
 *  delta always carries an arrow + text, never colour alone. */
export default function KpiTile({
  label,
  value,
  icon: Icon,
  change,
  previousLabel,
  spark,
  invert = false,
}: Props) {
  const hasChange = change != null && Number.isFinite(change);
  const dir = !hasChange || change === 0 ? 'flat' : change! > 0 ? 'up' : 'down';
  const positive = dir === 'flat' ? null : invert ? dir === 'down' : dir === 'up';

  const chipTone =
    positive === null
      ? 'text-neutral-500 dark:text-neutral-400'
      : positive
        ? 'text-[#006300] dark:text-[#0ca30c]'
        : 'text-[#d03b3b] dark:text-[#e06666]';

  const ChipIcon = dir === 'flat' ? Minus : dir === 'up' ? ArrowUpRight : ArrowDownRight;

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center gap-2 text-neutral-400 dark:text-neutral-500">
        {Icon && <Icon className="h-4 w-4" />}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
        {value}
      </p>
      {(hasChange || previousLabel) && (
        <div className="mt-1 flex items-center gap-1.5 text-xs">
          {hasChange && (
            <span className={`inline-flex items-center gap-0.5 font-medium ${chipTone}`}>
              <ChipIcon className="h-3 w-3" />
              {Math.abs(change!)}%
            </span>
          )}
          {previousLabel && (
            <span className="text-neutral-400 dark:text-neutral-500">{previousLabel}</span>
          )}
        </div>
      )}
      {spark && spark.length > 1 && (
        <div className="mt-2">
          <Sparkline values={spark} />
        </div>
      )}
    </div>
  );
}
