import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Calendar,
  Clock3,
  MapPin,
  Package,
  Pencil,
  Phone,
  Power,
  QrCode,
} from 'lucide-react';
import { getShopDetail, setShopStatus } from '@/services/superAdmin';
import { getApiErrorMessage } from '@/utils/apiError';
import { shopStatusBadge, trialBadgeTone } from '@/utils/shopStatus';
import Spinner from '@/components/Spinner';
import ErrorState from '@/components/ErrorState';
import Badge from '@/components/Badge';
import ConfirmDialog from '@/components/ConfirmDialog';
import ShopEditDialog from '@/components/super-admin/ShopEditDialog';
import QrCodeModal from '@/components/super-admin/QrCodeModal';
import { useToast } from '@/hooks/useToast';

export default function ShopDetailPage() {
  const { id } = useParams<{ id: string }>();
  const shopId = Number(id);
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isConfirmingDeactivate, setIsConfirmingDeactivate] = useState(false);
  const [isQrOpen, setIsQrOpen] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['super-admin', 'shops', shopId],
    queryFn: () => getShopDetail(shopId),
    enabled: Number.isFinite(shopId),
  });

  const statusMutation = useMutation({
    mutationFn: (isActive: boolean) => setShopStatus(shopId, isActive),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'shops', shopId] });
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'shops'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'dashboard'] });
      showToast(
        'success',
        updated.is_active ? `${updated.name} is active again.` : `${updated.name} was deactivated.`,
      );
    },
    onError: (err) => {
      showToast('error', getApiErrorMessage(err, 'Could not update the shop status.'));
    },
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

  const { shop, recent_activity: recentActivity } = data;
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
            <Badge tone={trialBadgeTone(shop.trial_status_label, shop.trial_days_remaining)}>
              {shop.trial_status_label}
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
            onClick={() => setIsQrOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3.5 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            <QrCode className="h-4 w-4" />
            QR Code
          </button>
          <button
            type="button"
            onClick={() => setIsEditOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3.5 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            <Pencil className="h-4 w-4" />
            Edit
          </button>
          {shop.is_active ? (
            <button
              type="button"
              onClick={() => setIsConfirmingDeactivate(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3.5 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              <Power className="h-4 w-4" />
              Deactivate
            </button>
          ) : (
            <button
              type="button"
              onClick={() => statusMutation.mutate(true)}
              disabled={statusMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 px-3.5 py-2 text-sm font-medium text-green-700 hover:bg-green-50 disabled:opacity-60"
            >
              <Power className="h-4 w-4" />
              Activate
            </button>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Products" value={shop.product_count} />
        <StatCard label="Available" value={shop.products_available} />
        <StatCard label="Sold" value={shop.products_sold} />
        <StatCard label="Added This Week" value={shop.products_added_this_week} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-neutral-200 bg-white p-5 lg:col-span-1">
          <h2 className="text-sm font-semibold text-neutral-900">Owner</h2>
          {shop.owner ? (
            <div className="mt-3 text-sm">
              <p className="font-medium text-neutral-900">{shop.owner.name}</p>
              <p className="text-neutral-500">{shop.owner.email}</p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-neutral-400">No owner account.</p>
          )}

          <h2 className="mt-6 text-sm font-semibold text-neutral-900">Shop profile</h2>
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
            <p className="mt-3 text-sm text-neutral-400">
              No profile details yet. Use Edit to add them.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-neutral-900">Recent activity</h2>
          {recentActivity.length === 0 ? (
            <div className="mt-6 flex flex-col items-center py-8 text-center">
              <Package className="h-8 w-8 text-neutral-300" />
              <p className="mt-3 text-sm text-neutral-500">No activity yet for this shop.</p>
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-neutral-100">
              {recentActivity.map((activity) => (
                <li key={activity.id} className="flex items-start gap-3 py-3 text-sm">
                  <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
                  <div>
                    <p className="text-neutral-800">{describeActivity(activity)}</p>
                    <p className="text-xs text-neutral-400">
                      {new Date(activity.created_at).toLocaleString()}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
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

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-neutral-900">{value}</p>
    </div>
  );
}

function describeActivity(activity: { action: string; product_name: string | null; user_name: string | null }): string {
  const actor = activity.user_name ?? 'Someone';
  switch (activity.action) {
    case 'SHOP_UPDATED':
      return `${actor} updated the shop profile.`;
    case 'PRODUCT_CREATED':
      return `${actor} added ${activity.product_name ?? 'a product'}.`;
    case 'PRODUCT_UPDATED':
      return `${actor} updated ${activity.product_name ?? 'a product'}.`;
    case 'PRODUCT_DELETED':
      return `${actor} deleted ${activity.product_name ?? 'a product'}.`;
    case 'PRODUCT_MARKED_SOLD':
      return `${actor} marked ${activity.product_name ?? 'a product'} as sold.`;
    case 'PRODUCT_MARKED_AVAILABLE':
      return `${actor} marked ${activity.product_name ?? 'a product'} as available.`;
    case 'PRODUCT_IMAGE_UPLOADED':
      return `${actor} uploaded a photo for ${activity.product_name ?? 'a product'}.`;
    default:
      return activity.action;
  }
}
