import { useDark } from '@/hooks/useDark';

/**
 * The analytics chart palette. Deliberately its own visual system, separate
 * from the product's maroon brand chrome: charts read in an analytical blue
 * (+ orange for a second series), deltas in reserved status colours.
 *
 * Values are the validated reference palette from the data-viz method —
 * light and dark are each stepped for their own surface, not an auto-flip.
 * Categorical blue↔orange clears every CVD/normal-vision gate in both modes.
 */
export interface ChartTokens {
  isDark: boolean;
  surface: string;
  grid: string;
  axis: string;
  baseline: string;
  ink: string;
  inkMuted: string;
  /** primary series (sequential blue) */
  s1: string;
  s1Fill: string;
  /** second series (orange) */
  s2: string;
  s2Fill: string;
  /** delta direction — status colours, always paired with an icon + text */
  good: string;
  bad: string;
}

const LIGHT: Omit<ChartTokens, 'isDark'> = {
  surface: '#ffffff',
  grid: '#e1e0d9',
  axis: '#898781',
  baseline: '#c3c2b7',
  ink: '#171717',
  inkMuted: '#6b6a66',
  s1: '#2a78d6',
  s1Fill: 'rgba(42,120,214,0.14)',
  s2: '#eb6834',
  s2Fill: 'rgba(235,104,52,0.14)',
  good: '#006300',
  bad: '#d03b3b',
};

const DARK: Omit<ChartTokens, 'isDark'> = {
  surface: '#171717',
  grid: '#2c2c2a',
  axis: '#8f8d87',
  baseline: '#383835',
  ink: '#f5f5f5',
  inkMuted: '#a3a29c',
  s1: '#3987e5',
  s1Fill: 'rgba(57,135,229,0.20)',
  s2: '#d95926',
  s2Fill: 'rgba(217,89,38,0.20)',
  good: '#0ca30c',
  bad: '#e06666',
};

export function useChartTokens(): ChartTokens {
  const isDark = useDark();
  return { isDark, ...(isDark ? DARK : LIGHT) };
}
