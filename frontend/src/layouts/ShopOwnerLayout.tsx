import { BarChart3, LayoutDashboard, LogOut, Package, Settings as SettingsIcon, Shirt, Tags } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

function navLinkClass({ isActive }: { isActive: boolean }): string {
  return `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-brand-50 text-brand-700' : 'text-neutral-600 hover:bg-neutral-100'
  }`;
}

export default function ShopOwnerLayout() {
  const { user, shop, logout } = useAuth();

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600">
              <Shirt className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-semibold text-neutral-900">
              {shop?.name ?? 'Digital Catalog SaaS'}
            </span>
            {shop && (
              <span className="ml-1 hidden rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500 sm:inline">
                {shop.trial_status_label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-neutral-500 sm:inline">{user?.email}</span>
            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
            >
              <LogOut className="h-4 w-4" />
              Log out
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-3 sm:px-6">
          <NavLink to="/admin" end className={navLinkClass}>
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </NavLink>
          <NavLink to="/admin/products" className={navLinkClass}>
            <Package className="h-4 w-4" />
            Products
          </NavLink>
          <NavLink to="/admin/categories" className={navLinkClass}>
            <Tags className="h-4 w-4" />
            Categories
          </NavLink>
          <NavLink to="/admin/analytics" className={navLinkClass}>
            <BarChart3 className="h-4 w-4" />
            Analytics
          </NavLink>
          <NavLink to="/admin/settings" className={navLinkClass}>
            <SettingsIcon className="h-4 w-4" />
            Settings
          </NavLink>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
