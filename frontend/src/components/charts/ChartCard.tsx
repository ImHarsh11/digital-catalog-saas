import type { ReactNode } from 'react';

/** Framed container for one chart: title, optional subtitle + right slot,
 *  body, and a built-in empty state. Matches the app's card styling. */
export default function ChartCard({
  title,
  subtitle,
  right,
  empty,
  emptyLabel = 'No data for this period',
  children,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  empty?: boolean;
  emptyLabel?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{title}</h3>
          {subtitle && (
            <p className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">{subtitle}</p>
          )}
        </div>
        {right}
      </div>
      <div className="mt-4">
        {empty ? (
          <div className="flex h-40 items-center justify-center text-sm text-neutral-400 dark:text-neutral-500">
            {emptyLabel}
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
