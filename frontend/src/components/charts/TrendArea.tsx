import { useId } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import ChartTooltip from './ChartTooltip';
import { useChartTokens } from './tokens';

export interface TrendSeries {
  key: string;
  name: string;
}

interface Props {
  data: Array<Record<string, string | number>>;
  series: TrendSeries[]; // 1 or 2
  height?: number;
  xKey?: string;
}

/** Time-series area chart, 1–2 series. Thin 2px lines, recessive dashed
 *  grid, gradient fill, crosshair + shared tooltip. A legend appears for
 *  two series (identity never rides on colour alone). */
export default function TrendArea({ data, series, height = 200, xKey = 'label' }: Props) {
  const t = useChartTokens();
  const gid = useId().replace(/:/g, '');
  const colors = [t.s1, t.s2];

  return (
    <div>
      {series.length > 1 && (
        <div className="mb-2 flex gap-4">
          {series.map((s, i) => (
            <span key={s.key} className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
              <span className="h-2 w-2 rounded-[2px]" style={{ background: colors[i] }} />
              {s.name}
            </span>
          ))}
        </div>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 4, right: 6, left: -18, bottom: 0 }}>
          <defs>
            {series.map((s, i) => (
              <linearGradient key={s.key} id={`${gid}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors[i]} stopOpacity={0.22} />
                <stop offset="100%" stopColor={colors[i]} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false} />
          <XAxis
            dataKey={xKey}
            tick={{ fontSize: 10, fill: t.axis }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: t.axis }}
            axisLine={false}
            tickLine={false}
            width={38}
            allowDecimals={false}
          />
          <Tooltip
            content={<ChartTooltip />}
            cursor={{ stroke: t.baseline, strokeWidth: 1 }}
          />
          {series.map((s, i) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={colors[i]}
              strokeWidth={2}
              fill={`url(#${gid}-${s.key})`}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: t.surface, fill: colors[i] }}
              isAnimationActive={false}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
