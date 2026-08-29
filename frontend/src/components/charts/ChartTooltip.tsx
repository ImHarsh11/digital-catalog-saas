interface TooltipEntry {
  dataKey?: string | number;
  name?: string | number;
  value?: number | string;
  color?: string;
  stroke?: string;
  fill?: string;
}

interface Props {
  active?: boolean;
  label?: string | number;
  payload?: TooltipEntry[];
}

/** Shared tooltip body for every chart. The series value carries a colour
 *  swatch for identity; the numbers themselves stay in ink. */
export default function ChartTooltip({ active, payload, label }: Props) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs shadow-sm dark:border-neutral-700 dark:bg-neutral-800">
      {label != null && (
        <p className="mb-1 font-medium text-neutral-500 dark:text-neutral-400">{String(label)}</p>
      )}
      {payload.map((p, i) => (
        <div key={String(p.dataKey ?? i)} className="flex items-center gap-1.5">
          <span
            className="h-2 w-2 shrink-0 rounded-[2px]"
            style={{ background: p.color ?? p.stroke ?? p.fill ?? 'currentColor' }}
          />
          <span className="text-neutral-500 dark:text-neutral-400">{p.name}</span>
          <span className="ml-auto font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
            {typeof p.value === 'number' ? p.value.toLocaleString('en-IN') : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}
