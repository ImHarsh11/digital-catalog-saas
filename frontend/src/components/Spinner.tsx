import { Loader2 } from 'lucide-react';

export default function Spinner({ className = 'h-6 w-6' }: { className?: string }) {
  return <Loader2 className={`animate-spin text-neutral-400 ${className}`} aria-label="Loading" />;
}
