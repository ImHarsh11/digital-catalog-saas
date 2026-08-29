import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Calendar,
  CreditCard,
  ExternalLink,
  MapPin,
  Pencil,
  Phone,
  Power,
  QrCode,
  RefreshCw,
} from 'lucide-react';
import {
  cancelShopSubscription,
  createShopSubscription,
  getShopDetail,
  listShopInvoices,
  reconcileShopSubscription,
  setShopStatus,
  updateShopBilling,
} from '@/services/superAdmin';
import { getApiErrorMessage } from '@/utils/apiError';
import { shopStatusBadge } from '@/utils/shopStatus';
import Spinner from '@/components/Spinner';
import ErrorState from '@/components/ErrorState';
import Badge from '@/components/Badge';
import ConfirmDialog from '@/components/ConfirmDialog';
import ShopEditDialog from '@/components/super-admin/ShopEditDialog';
import QrCodeModal from '@/components/super-admin/QrCodeModal';
import ThemeTab from '@/components/super-admin/ThemeTab';
import { useToast } from '@/hooks/useToast';
import { formatPrice } from '@/utils/currency';
import type { ShopBillingDetail, SubscriptionStatus } from '@/types/shop';

type Tab = 'overview' | 'billing' | 'theme' | 'access';

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'billing', label: 'Billing' },
  { key: 'theme', label: 'Theme' },
  { key: 'access', label: 'Access' },
];

export default function ShopDetailPage() {
  const { id } = useParams<{ id: string }>();
  const shopId = Number(id);
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [tab, setTab] = useState<Tab>('overview');
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isConfirmingDeactivate, setIsConfirmingDeactivate] = useState(false);
  const [isQrOpen, setIsQrOpen] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['super-admin', 'shops', shopId],
    queryFn: () => getShopDetail(shopId),
    enabled: Number.isFinite(shopId),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['super-admin', 'shops', shopId] });
    queryClient.invalidateQueries({ queryKey: ['super-admin', 'shops'] });
    queryClient.invalidateQueries({ queryKey: ['super-admin', 'dashboard'] });
  };

  const statusMutation = useMutation({
    mutationFn: (isActive: boolean) => setShopStatus(shopId, isActive),
    onSuccess: (updated) => {
      invalidate();
      showToast(
        'success',
        updated.is_active ? `${updated.name} is active again.` : `${updated.name} was deactivated.`,
      );
    },
    onError: (err) => showToast('error', getApiErrorMessage(err, 'Could not update the shop status.')),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <ErrorState
        title="Couldn't load this shop"
        message={getApiErrorMessage(error, 'This shop could not be found.')}
        onRetry={() => refetch()}
      />
    );
  }

  const { shop, billing, theme_config: themeConfig, theme_resolved: themeResolved } = data;
  const status = shopStatusBadge(shop);

  return (
    <div>
      <Link
        to="/super-admin/shops"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-neutral-700"
      >
        <ArrowLeft className="h-4 w-4" />
        All shops
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-neutral-900">{shop.name}</h1>
            <Badge tone={status.tone}>{status.label}</Badge>
            <Badge tone={billing.is_catalog_live ? 'green' : 'red'}>
              {billing.is_catalog_live ? 'Catalog live' : 'Catalog offline'}
            </Badge>
          </div>
          <button
            type="button"
            onClick={() => setIsQrOpen(true)}
            className="mt-1 flex items-center gap-1.5 text-sm text-neutral-500 hover:text-brand-700"
          >
            <QrCode className="h-4 w-4" />
            /shop/{shop.slug}
          </button>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setIsEditOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3.5 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            <Pencil className="h-4 w-4" />
            Edit
          </button>
        </div>
      </div>

      <div className="mt-6 border-b border-neutral-200">
        <nav className="-mb-px flex gap-6">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`border-b-2 pb-2.5 text-sm font-medium ${
                tab === t.key
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-6">
        {tab === 'overview' && <OverviewTab shop={shop} />}
        {tab === 'billing' && (
          <BillingTab
            shopId={shopId}
            billing={billing}
            onSaved={() => {
              invalidate();
              showToast('success', 'Billing updated.');
            }}
          />
        )}
        {tab === 'theme' && (
          <ThemeTab
            shopId={shopId}
            shopSlug={shop.slug}
            themeConfig={themeConfig}
            themeResolved={themeResolved}
            onSaved={() => {
              invalidate();
              showToast('success', 'Theme updated.');
            }}
          />
        )}
        {tab === 'access' && (
          <AccessTab
            shop={shop}
            isPending={statusMutation.isPending}
            onActivate={() => statusMutation.mutate(true)}
            onDeactivate={() => setIsConfirmingDeactivate(true)}
            onOpenQr={() => setIsQrOpen(true)}
          />
        )}
      </div>

      {isEditOpen && <ShopEditDialog shop={shop} onClose={() => setIsEditOpen(false)} />}

      {isQrOpen && (
        <QrCodeModal
          shopId={shop.id}
          shopName={shop.name}
          shopSlug={shop.slug}
          onClose={() => setIsQrOpen(false)}
        />
      )}

      {isConfirmingDeactivate && (
        <ConfirmDialog
          title="Deactivate shop"
          message={`This takes "${shop.name}"'s catalog offline for customers immediately. You can reactivate it at any time.`}
          confirmLabel="Deactivate"
          isDestructive
          isSubmitting={statusMutation.isPending}
          onConfirm={() =>
            statusMutation.mutate(false, { onSettled: () => setIsConfirmingDeactivate(false) })
          }
          onCancel={() => setIsConfirmingDeactivate(false)}
        />
      )}
    </div>
  );
}

function OverviewTab({ shop }: { shop: import('@/types/shop').ShopDetail }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-neutral-900">Owner</h2>
        {shop.owner ? (
          <div className="mt-3 text-sm">
            <p className="font-medium text-neutral-900">{shop.owner.name}</p>
            <p className="text-neutral-500">{shop.owner.email}</p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-neutral-400">No owner account.</p>
        )}
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-neutral-900">Shop profile</h2>
        <dl className="mt-3 space-y-2 text-sm text-neutral-600">
          {shop.city && (
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
              <span>
                {shop.address ? `${shop.address}, ` : ''}
                {shop.city}
              </span>
            </div>
          )}
          {shop.phone && (
            <div className="flex items-start gap-2">
              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
              <span>{shop.phone}</span>
            </div>
          )}
          <div className="flex items-start gap-2">
            <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
            <span>Created {new Date(shop.created_at).toLocaleDateString()}</span>
          </div>
        </dl>
        {shop.description && (
          <p className="mt-4 text-sm leading-relaxed text-neutral-600">{shop.description}</p>
        )}
        {!shop.city && !shop.phone && !shop.description && (
          <p className="mt-3 text-sm text-neutral-400">No profile details yet. Use Edit to add them.</p>
        )}
      </section>
    </div>
  );
}

const STATUS_OPTIONS: SubscriptionStatus[] = [
  'TRIAL',
  'ACTIVE',
  'PAST_DUE',
  'EXPIRED',
  'SUSPENDED',
  'CANCELLED',
];

function BillingTab({
  shopId,
  billing,
  onSaved,
}: {
  shopId: number;
  billing: ShopBillingDetail;
  onSaved: () => void;
}) {
  const { showToast } = useToast();
  const [status, setStatus] = useState<SubscriptionStatus>(billing.status);
  const [trialEnd, setTrialEnd] = useState(billing.trial_end_date ?? '');
  const [paidUntil, setPaidUntil] = useState(billing.paid_until ?? '');

  const mutation = useMutation({
    mutationFn: () =>
      updateShopBilling(shopId, {
        status,
        trial_end_date: trialEnd || null,
        paid_until: paidUntil || null,
      }),
    onSuccess: onSaved,
    onError: (err) => showToast('error', getApiErrorMessage(err, 'Could not update billing.')),
  });

  const dirty =
    status !== billing.status ||
    (trialEnd || '') !== (billing.trial_end_date ?? '') ||
    (paidUntil || '') !== (billing.paid_until ?? '');

  return (
    <div className="max-w-xl space-y-6">
      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-neutral-900">Current state</h2>
        <dl className="mt-3 grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-neutral-500">Status</dt>
          <dd className="font-medium text-neutral-900">{billing.lifecycle_label}</dd>
          <dt className="text-neutral-500">Catalog</dt>
          <dd className="font-medium text-neutral-900">
            {billing.is_catalog_live ? 'Live' : 'Offline'}
          </dd>
          <dt className="text-neutral-500">Trial ends</dt>
          <dd className="text-neutral-700">{billing.trial_end_date ?? '—'}</dd>
          <dt className="text-neutral-500">Paid until</dt>
          <dd className="text-neutral-700">{billing.paid_until ?? '—'}</dd>
        </dl>
      </section>

      <SubscriptionSection shopId={shopId} billing={billing} onChanged={onSaved} />

      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-neutral-900">Adjust manually</h2>
        <p className="mt-1 text-xs text-neutral-400">
          Overrides for support, comps, or a missed webhook. Razorpay is the normal path.
        </p>
        <form
          className="mt-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <label className="block text-sm">
            <span className="text-neutral-600">Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as SubscriptionStatus)}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-neutral-600">Trial end date</span>
            <input
              type="date"
              value={trialEnd}
              onChange={(e) => setTrialEnd(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="text-neutral-600">Paid until</span>
            <input
              type="date"
              value={paidUntil}
              onChange={(e) => setPaidUntil(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={!dirty || mutation.isPending}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {mutation.isPending ? 'Saving…' : 'Save billing'}
          </button>
        </form>
      </section>
    </div>
  );
}

function SubscriptionSection({
  shopId,
  billing,
  onChanged,
}: {
  shopId: number;
  billing: ShopBillingDetail;
  onChanged: () => void;
}) {
  const { showToast } = useToast();

  const invoicesQuery = useQuery({
    queryKey: ['super-admin', 'shops', shopId, 'invoices'],
    queryFn: () => listShopInvoices(shopId),
    enabled: billing.has_subscription,
  });

  const create = useMutation({
    mutationFn: () => createShopSubscription(shopId),
    onSuccess: (res) => {
      onChanged();
      if (res.authorization_url) {
        window.open(res.authorization_url, '_blank', 'noopener');
        showToast('success', 'Subscription created — authorization page opened for the owner.');
      } else {
        showToast('success', 'Subscription created.');
      }
    },
    onError: (err) => showToast('error', getApiErrorMessage(err, 'Could not create the subscription.')),
  });

  const cancel = useMutation({
    mutationFn: () => cancelShopSubscription(shopId, true),
    onSuccess: () => {
      onChanged();
      showToast('success', 'Subscription set to cancel at period end.');
    },
    onError: (err) => showToast('error', getApiErrorMessage(err, 'Could not cancel.')),
  });

  const reconcile = useMutation({
    mutationFn: () => reconcileShopSubscription(shopId),
    onSuccess: () => {
      onChanged();
      showToast('success', 'Re-synced from Razorpay.');
    },
    onError: (err) => showToast('error', getApiErrorMessage(err, 'Could not reconcile.')),
  });

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-5">
      <div className="flex items-center gap-2">
        <CreditCard className="h-4 w-4 text-neutral-400" />
        <h2 className="text-sm font-semibold text-neutral-900">Razorpay subscription</h2>
      </div>

      {billing.has_subscription ? (
        <>
          <dl className="mt-3 grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-neutral-500">Plan</dt>
            <dd className="text-neutral-800">
              {billing.plan_name ?? '—'}
              {billing.plan_amount != null && ` · ${formatPrice(billing.plan_amount / 100)}/mo`}
            </dd>
            <dt className="text-neutral-500">Mandate</dt>
            <dd className="font-medium text-neutral-900">{billing.mandate_status ?? '—'}</dd>
            <dt className="text-neutral-500">Subscription ID</dt>
            <dd className="truncate font-mono text-xs text-neutral-500">
              {billing.razorpay_subscription_id}
            </dd>
          </dl>

          {billing.cancel_at_period_end && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Scheduled to cancel at the end of the current paid period.
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => reconcile.mutate()}
              disabled={reconcile.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Re-sync
            </button>
            {!billing.cancel_at_period_end &&
              ['ACTIVE', 'PAST_DUE'].includes(billing.status) && (
                <button
                  type="button"
                  onClick={() => cancel.mutate()}
                  disabled={cancel.isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  Cancel at period end
                </button>
              )}
          </div>

          {invoicesQuery.data && invoicesQuery.data.length > 0 && (
            <div className="mt-4 border-t border-neutral-100 pt-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
                Payments
              </p>
              <ul className="mt-2 space-y-1.5 text-sm">
                {invoicesQuery.data.map((inv, i) => (
                  <li key={i} className="flex justify-between">
                    <span className="text-neutral-500">
                      {new Date(inv.paid_at).toLocaleDateString()}
                    </span>
                    <span className="font-medium tabular-nums text-neutral-800">
                      {formatPrice(inv.amount / 100)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-neutral-500">
            No subscription yet. Creating one generates a Razorpay authorization link for the owner
            to approve UPI autopay.
          </p>
          <button
            type="button"
            onClick={() => create.mutate()}
            disabled={create.isPending}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            <ExternalLink className="h-4 w-4" />
            {create.isPending ? 'Creating…' : 'Create subscription'}
          </button>
        </>
      )}
    </section>
  );
}

function AccessTab({
  shop,
  isPending,
  onActivate,
  onDeactivate,
  onOpenQr,
}: {
  shop: import('@/types/shop').ShopDetail;
  isPending: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
  onOpenQr: () => void;
}) {
  return (
    <div className="max-w-xl space-y-6">
      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-neutral-900">Catalog visibility</h2>
        <p className="mt-1 text-sm text-neutral-500">
          {shop.is_active
            ? 'This shop’s catalog is switched on. Billing state still decides whether customers can reach it.'
            : 'This shop’s catalog is switched off for customers.'}
        </p>
        <div className="mt-4">
          {shop.is_active ? (
            <button
              type="button"
              onClick={onDeactivate}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3.5 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              <Power className="h-4 w-4" />
              Deactivate catalog
            </button>
          ) : (
            <button
              type="button"
              onClick={onActivate}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 px-3.5 py-2 text-sm font-medium text-green-700 hover:bg-green-50 disabled:opacity-60"
            >
              <Power className="h-4 w-4" />
              Activate catalog
            </button>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-neutral-900">QR code</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Printable QR pointing at <code className="text-xs">/shop/{shop.slug}</code>.
        </p>
        <button
          type="button"
          onClick={onOpenQr}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3.5 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          <QrCode className="h-4 w-4" />
          Open QR code
        </button>
      </section>
    </div>
  );
}
