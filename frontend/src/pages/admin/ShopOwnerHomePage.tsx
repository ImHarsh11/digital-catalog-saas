import { LogOut, Shirt } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

/**
 * Placeholder landing page for the SHOP_OWNER role.
 *
 * The full shop-owner dashboard (product CRUD, categories, image uploads)
 * is Phase 4 scope -- this just gives a shop owner somewhere to land after
 * logging in, with confirmation their account and trial are working,
 * rather than a dead end.
 */
export default function ShopOwnerHomePage() {
  const { user, shop, logout } = useAuth();

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600">
              <Shirt className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-semibold text-neutral-900">Digital Catalog SaaS</span>
          </div>
          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center">
          <h1 className="text-xl font-semibold text-neutral-900">
            Welcome, {shop?.name ?? user?.name}
          </h1>
          <p className="mt-2 text-sm text-neutral-500">
            Your shop-owner dashboard (products, categories, photos) is coming soon.
          </p>
          {shop && (
            <div className="mt-6 inline-flex flex-col items-center gap-1 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm">
              <span className="text-neutral-500">Catalog URL</span>
              <span className="font-medium text-neutral-900">/shop/{shop.slug}</span>
              <span className="mt-1 text-brand-600">{shop.trial_status_label}</span>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
