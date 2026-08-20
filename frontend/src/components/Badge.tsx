import type { ReactNode } from 'react';

type Tone = 'green' | 'amber' | 'red' | 'neutral' | 'blue';

const TONE_CLASSES: Record<Tone, string> = {
  green: 'bg-green-50 text-green-700 border-green-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  red: 'bg-red-50 text-red-700 border-red-200',
  neutral: 'bg-neutral-100 text-neutral-600 border-neutral-200',
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
};

export default function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}
