import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import ChartTooltip from './ChartTooltip';
import { useChartTokens } from './tokens';

interface Props {
  data: Array<Record<string, string | number>>;
  dataKey: string;
  name: string;
  height?: number;
  xKey?: string;
}

/** Single-series time bars. 4px rounded data-ends anchored to the baseline,
 *  per-bar hover tooltip, recessive horizontal grid only. */
export default function BarSeries({ data, dataKey, name, height = 200, xKey = 'label' }: Props) {
  const t = useChartTokens();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 6, left: -18, bottom: 0 }}>
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
        <Tooltip content={<ChartTooltip />} cursor={{ fill: t.s1Fill }} />
        <Bar
          dataKey={dataKey}
          name={name}
          fill={t.s1}
          radius={[4, 4, 0, 0]}
          maxBarSize={34}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
