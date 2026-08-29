import {
  BarChart3,
  LayoutDashboard,
  LogOut,
  Monitor,
  Moon,
  Package,
  Settings as SettingsIcon,
  Shirt,
  Sun,
  Tags,
  Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { BillingBanner } from '@/components/admin/BillingPanel';

// ─── Theme helpers ────────────────────────────────────────────────────────────

type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'catalog-theme';

function getSystemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'dark' || (theme === 'system' && getSystemPrefersDark())) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

function loadTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {}
  return 'system';
}

function saveTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {}
}

// ─── ThemeToggle component ────────────────────────────────────────────────────

const THEME_OPTIONS: { value: Theme; icon: React.ReactNode; label: string }[] = [
  { value: 'light', icon: <Sun className="h-3.5 w-3.5" />, label: 'Light' },
  { value: 'dark', icon: <Moon className="h-3.5 w-3.5" />, label: 'Dark' },
  { value: 'system', icon: <Monitor className="h-3.5 w-3.5" />, label: 'System' },
];

function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(loadTheme);

  // Apply on mount and whenever system preference changes (when in system mode)
  useEffect(() => {
    applyTheme(theme);

    if (theme !== 'system') return;

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  function handleSelect(value: Theme) {
    setTheme(value);
    saveTheme(value);
    applyTheme(value);
  }

  return (
    <div
      className="flex items-center rounded-lg border border-neutral-200 p-0.5 dark:border-neutral-700"
      role="group"
      aria-label="Theme"
    >
      {THEME_OPTIONS.map(({ value, icon, label }) => (
        <button
          key={value}
          type="button"
          onClick={() => handleSelect(value)}
          aria-pressed={theme === value}
          title={label}
          className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
            theme === value
              ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
              : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200'
          }`}
        >
          {icon}
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Nav helpers ──────────────────────────────────────────────────────────────

function navLinkClass({ isActive }: { isActive: boolean }): string {
  return `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive
      ? 'bg-brand-50 text-brand-700 dark:bg-neutral-800 dark:text-white'
      : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200'
  }`;
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function ShopOwnerLayout() {
  const { user, shop, logout } = useAuth();

  // Apply saved theme on initial render (before any state update)
  useEffect(() => {
    applyTheme(loadTheme());
  }, []);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <header className="border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600">
              <Shirt className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-semibold text-neutral-900 dark:text-white">
              {shop?.name ?? 'Digital Catalog SaaS'}
            </span>
            {shop && (
              <span className="ml-1 hidden rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400 sm:inline">
                {shop.trial_status_label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-neutral-500 dark:text-neutral-400 sm:inline">
              {user?.email}
            </span>
            <ThemeToggle />
            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
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
          <NavLink to="/admin/leads" className={navLinkClass}>
            <Users className="h-4 w-4" />
            Leads
          </NavLink>
          <NavLink to="/admin/settings" className={navLinkClass}>
            <SettingsIcon className="h-4 w-4" />
            Settings
          </NavLink>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {shop && <BillingBanner shopId={shop.id} />}
        <Outlet />
      </main>
    </div>
  );
}
