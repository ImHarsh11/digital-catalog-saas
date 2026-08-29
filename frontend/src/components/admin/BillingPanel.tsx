import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertTriangle, CreditCard, ExternalLink, Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getOwnerBilling, getOwnerInvoices, startOwnerSubscription } from '@/services/shopOwner';
import { getApiErrorMessage } from '@/utils/apiError';
import { formatPrice } from '@/utils/currency';
import { useToast } from '@/hooks/useToast';
import Spinner from '@/components/Spinner';
import type { ShopBillingDetail } from '@/types/shop';

function billingKey(shopId: number) {
  return ['shop-owner', 'billing', shopId] as const;
}

/** A one-line alert shown across the owner area when billing needs
 *  attention. Silent when everything is fine. */
export function BillingBanner({ shopId }: { shopId: number }) {
  const { data } = useQuery({
    queryKey: billingKey(shopId),
    queryFn: () => getOwnerBilling(shopId),
    enabled: Number.isFinite(shopId),
    staleTime: 120_000,
  });
  if (!data) return null;

  const msg = bannerMessage(data);
  if (!msg) return null;

  return (
    <div
      className={`mb-4 flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm ${
        msg.tone === 'danger'
          ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300'
          : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300'
      }`}
    >
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span className="flex-1">{msg.text}</span>
      <Link to="/admin/settings" className="shrink-0 font-semibold underline">
        {msg.cta}
      </Link>
    </div>
  );
}

function bannerMessage(
  b: ShopBillingDetail,
): { tone: 'warn' | 'danger'; text: string; cta: string } | null {
  if (b.status === 'PAST_DUE') {
    return {
      tone: 'danger',
      text: `A payment failed. Your catalog goes offline ${
        b.grace_until ? `on ${b.grace_until}` : 'soon'
      } unless autopay is fixed.`,
      cta: 'Fix payment',
    };
  }
  if (b.status === 'EXPIRED') {
    return { tone: 'danger', text: 'Your catalog is offline. Start a subscription to bring it back.', cta: 'Subscribe' };
  }
  if (b.status === 'CANCELLED') {
    return {
      tone: 'warn',
      text: `Subscription cancelled${b.paid_until ? ` — catalog stays live until ${b.paid_until}` : ''}.`,
      cta: 'Resubscribe',
    };
  }
  if (b.status === 'TRIAL' && !b.has_subscription && b.days_remaining <= 5) {
    return {
      tone: 'warn',
      text:
        b.days_remaining <= 0
          ? 'Your free trial has ended.'
          : `Your free trial ends in ${b.days_remaining} day${b.days_remaining === 1 ? '' : 's'}.`,
      cta: 'Set up autopay',
    };
  }
  return null;
}

const STATUS_LABEL: Record<string, string> = {
  TRIAL: 'Free trial',
  ACTIVE: 'Active',
  PAST_DUE: 'Payment overdue',
  EXPIRED: 'Expired',
  SUSPENDED: 'Suspended',
  CANCELLED: 'Cancelled',
};

/** Full billing card for the Settings page: status, plan, invoices, and the
 *  one action the owner can take — set up / renew UPI autopay. */
export function BillingCard({ shopId }: { shopId: number }) {
  const { showToast } = useToast();

  const { data, isLoading, refetch } = useQuery({
    queryKey: billingKey(shopId),
    queryFn: () => getOwnerBilling(shopId),
    enabled: Number.isFinite(shopId),
  });

  const invoices = useQuery({
    queryKey: ['shop-owner', 'invoices', shopId],
    queryFn: () => getOwnerInvoices(shopId),
    enabled: Number.isFinite(shopId) && Boolean(data?.has_subscription),
  });

  const start = useMutation({
    mutationFn: () => startOwnerSubscription(shopId),
    onSuccess: (res) => {
      refetch();
      if (res.authorization_url) {
        window.open(res.authorization_url, '_blank', 'noopener');
        showToast('success', 'Approve the UPI autopay mandate in the new tab.');
      }
    },
    onError: (err) => showToast('error', getApiErrorMessage(err, 'Could not start the subscription.')),
  });

  const showSubscribe =
    data &&
    !data.cancel_at_period_end &&
    (['EXPIRED', 'CANCELLED'].includes(data.status) ||
      (data.status === 'TRIAL' && !data.has_subscription) ||
      (data.status === 'PAST_DUE' && !data.has_subscription));

  return (
    <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center gap-2">
        <CreditCard className="h-4 w-4 text-neutral-400" />
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Billing</h2>
      </div>

      {isLoading || !data ? (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      ) : (
        <>
          <dl className="mt-3 grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-neutral-500">Plan</dt>
            <dd className="text-neutral-800 dark:text-neutral-200">
              {data.plan_name
                ? `${data.plan_name}${data.plan_amount != null ? ` · ${formatPrice(data.plan_amount / 100)}/mo` : ''}`
                : 'Free trial'}
            </dd>
            <dt className="text-neutral-500">Status</dt>
            <dd className="font-medium text-neutral-900 dark:text-neutral-100">
              {STATUS_LABEL[data.status] ?? data.status}
              {data.status === 'TRIAL' && data.days_remaining > 0 && ` · ${data.days_remaining} days left`}
            </dd>
            <dt className="text-neutral-500">Catalog</dt>
            <dd className={data.is_catalog_live ? 'text-green-600' : 'text-red-600'}>
              {data.is_catalog_live ? 'Live' : 'Offline'}
            </dd>
            {data.paid_until && (
              <>
                <dt className="text-neutral-500">Paid until</dt>
                <dd className="text-neutral-700 dark:text-neutral-300">{data.paid_until}</dd>
              </>
            )}
          </dl>

          {data.cancel_at_period_end && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              Autopay is set to stop at the end of this period.
            </p>
          )}

          {showSubscribe && (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => start.mutate()}
                disabled={start.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                <ExternalLink className="h-4 w-4" />
                {start.isPending ? 'Starting…' : 'Set up UPI autopay'}
              </button>
              <p className="mt-2 flex items-start gap-1.5 text-xs text-neutral-400">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Opens Razorpay to approve a monthly autopay mandate. You can cancel anytime.
              </p>
            </div>
          )}

          {data.has_subscription && data.status === 'PAST_DUE' && (
            <p className="mt-4 text-xs text-red-600">
              Your bank declined the last autopay charge. Razorpay will retry automatically; if it
              keeps failing, update your UPI mandate from the Razorpay SMS/email.
            </p>
          )}

          {invoices.data && invoices.data.length > 0 && (
            <div className="mt-4 border-t border-neutral-100 pt-3 dark:border-neutral-800">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
                Payments
              </p>
              <ul className="mt-2 space-y-1.5 text-sm">
                {invoices.data.map((inv, i) => (
                  <li key={i} className="flex justify-between">
                    <span className="text-neutral-500">
                      {new Date(inv.paid_at).toLocaleDateString()}
                    </span>
                    <span className="font-medium tabular-nums text-neutral-800 dark:text-neutral-200">
                      {formatPrice(inv.amount / 100)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
