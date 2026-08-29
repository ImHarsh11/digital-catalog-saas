import { useId } from 'react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { useChartTokens } from './tokens';

/** Tiny trend, no axes or labels — for stat tiles. */
export default function Sparkline({
  values,
  height = 36,
}: {
  values: number[];
  height?: number;
}) {
  const t = useChartTokens();
  const gid = useId().replace(/:/g, '');
  if (values.length < 2) return null;
  const data = values.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={t.s1} stopOpacity={0.2} />
            <stop offset="100%" stopColor={t.s1} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="v"
          stroke={t.s1}
          strokeWidth={1.5}
          fill={`url(#${gid})`}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
