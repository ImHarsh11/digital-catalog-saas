import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Store } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { getShopProfile, updateShopProfile } from '@/services/shopOwner';
import { getApiErrorMessage } from '@/utils/apiError';
import { trialBadgeTone } from '@/utils/shopStatus';
import Spinner from '@/components/Spinner';
import ErrorState from '@/components/ErrorState';
import Badge from '@/components/Badge';
import { BillingCard } from '@/components/admin/BillingPanel';
import type { ShopDetail } from '@/types/shop';

const inputClass =
  'w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-base focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';

interface FormState {
  city: string;
  phone: string;
  address: string;
  website: string;
  description: string;
}

function initialFormState(profile: ShopDetail): FormState {
  return {
    city: profile.city ?? '',
    phone: profile.phone ?? '',
    address: profile.address ?? '',
    website: profile.website ?? '',
    description: profile.description ?? '',
  };
}

export default function SettingsPage() {
  const { shop } = useAuth();
  const shopId = shop?.id as number;
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);

  const { data: profile, isLoading, isError, error: fetchError, refetch } = useQuery({
    queryKey: ['shop-owner', 'profile', shopId],
    queryFn: () => getShopProfile(shopId),
    enabled: Number.isFinite(shopId),
  });

  const catalogPath = shop ? `/shop/${shop.slug}` : '';

  function copyCatalogUrl() {
    if (!catalogPath) return;
    const fullUrl = `${window.location.origin}${catalogPath}`;
    navigator.clipboard
      .writeText(fullUrl)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => showToast('error', 'Could not copy the link.'));
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-semibold text-neutral-900">Settings</h1>
      <p className="mt-1 text-sm text-neutral-500">Your shop's catalog link, trial status, and contact details.</p>

      <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-5">
        <div className="flex items-center gap-2">
          <Store className="h-4 w-4 text-neutral-400" />
          <h2 className="text-sm font-semibold text-neutral-900">{shop?.name}</h2>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {shop && (
            <Badge tone={trialBadgeTone(shop.trial_status_label, shop.trial_days_remaining)}>
              {shop.trial_status_label}
            </Badge>
          )}
          <Badge tone={shop?.is_active ? 'green' : 'neutral'}>{shop?.is_active ? 'Active' : 'Inactive'}</Badge>
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
          <span className="flex-1 truncate text-sm text-neutral-600">{catalogPath}</span>
          <button
            type="button"
            onClick={copyCatalogUrl}
            className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50"
          >
            <Copy className="h-3.5 w-3.5" />
            {copied ? 'Copied!' : 'Copy link'}
          </button>
        </div>
        <p className="mt-2 text-xs text-neutral-400">
          This is where customers will view your catalog once it's live.
        </p>
      </div>

      {isLoading && (
        <div className="mt-6 flex justify-center py-10">
          <Spinner />
        </div>
      )}

      {isError && (
        <div className="mt-6">
          <ErrorState message={getApiErrorMessage(fetchError)} onRetry={() => refetch()} />
        </div>
      )}

      <BillingCard shopId={shopId} />

      {profile && <ProfileForm shopId={shopId} profile={profile} />}
    </div>
  );
}

function ProfileForm({ shopId, profile }: { shopId: number; profile: ShopDetail }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [form, setForm] = useState<FormState>(() => initialFormState(profile));
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      updateShopProfile(shopId, {
        city: form.city || undefined,
        phone: form.phone || undefined,
        address: form.address || undefined,
        website: form.website || undefined,
        description: form.description || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shop-owner', 'profile', shopId] });
      showToast('success', 'Shop details saved.');
    },
    onError: (err) => {
      setError(getApiErrorMessage(err, 'Could not save these changes. Please try again.'));
    },
  });

  function update<K extends keyof FormState>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    mutation.mutate();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4 rounded-xl border border-neutral-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-neutral-900">Contact details</h2>
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-neutral-700">City</span>
          <input
            type="text"
            value={form.city}
            onChange={(e) => update('city', e.target.value)}
            className={`mt-1 ${inputClass}`}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-neutral-700">Phone</span>
          <input
            type="text"
            value={form.phone}
            onChange={(e) => update('phone', e.target.value)}
            className={`mt-1 ${inputClass}`}
          />
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-medium text-neutral-700">Address</span>
        <input
          type="text"
          value={form.address}
          onChange={(e) => update('address', e.target.value)}
          className={`mt-1 ${inputClass}`}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-neutral-700">Website</span>
        <input
          type="text"
          value={form.website}
          onChange={(e) => update('website', e.target.value)}
          className={`mt-1 ${inputClass}`}
          placeholder="https://"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-neutral-700">About your shop</span>
        <textarea
          value={form.description}
          onChange={(e) => update('description', e.target.value)}
          rows={3}
          className={`mt-1 ${inputClass}`}
          placeholder="A short description customers will see"
        />
      </label>

      <div className="flex justify-end border-t border-neutral-100 pt-4">
        <button
          type="submit"
          disabled={mutation.isPending}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {mutation.isPending ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}
