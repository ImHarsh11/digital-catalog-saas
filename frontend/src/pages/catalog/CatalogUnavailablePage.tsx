import { Store } from 'lucide-react';

interface CatalogUnavailablePageProps {
  title: string;
  message: string;
}

/** Shown for both "no such shop" (404) and "shop inactive/suspended" (403)
 * -- deliberately generic and friendly, never mentions subscription/trial
 * status or any other internal reason the catalog isn't reachable. */
export default function CatalogUnavailablePage({ title, message }: CatalogUnavailablePageProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-neutral-100">
        <Store className="h-7 w-7 text-neutral-400" />
      </div>
      <h1 className="mt-4 text-lg font-semibold text-neutral-900">{title}</h1>
      <p className="mt-1.5 max-w-sm text-sm text-neutral-500">{message}</p>
    </div>
  );
}
