import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Store } from 'lucide-react';
import { listShops, setShopStatus } from '@/services/superAdmin';
import { getApiErrorMessage } from '@/utils/apiError';
import { shopStatusBadge, trialBadgeTone } from '@/utils/shopStatus';
import Spinner from '@/components/Spinner';
import ErrorState from '@/components/ErrorState';
import Badge from '@/components/Badge';
import ConfirmDialog from '@/components/ConfirmDialog';
import ShopFormDialog from '@/components/super-admin/ShopFormDialog';
import { useToast } from '@/hooks/useToast';
import type { ShopListItem } from '@/types/shop';

export default function ShopsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [shopToDeactivate, setShopToDeactivate] = useState<ShopListItem | null>(null);

  const { data: shops, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['super-admin', 'shops'],
    queryFn: listShops,
  });

  const statusMutation = useMutation({
    mutationFn: ({ shopId, isActive }: { shopId: number; isActive: boolean }) =>
      setShopStatus(shopId, isActive),
    onSuccess: (updated) => {
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

  function handleReactivate(shop: ShopListItem) {
    statusMutation.mutate({ shopId: shop.id, isActive: true });
  }

  function handleConfirmDeactivate() {
    if (!shopToDeactivate) return;
    statusMutation.mutate(
      { shopId: shopToDeactivate.id, isActive: false },
      { onSettled: () => setShopToDeactivate(null) },
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Shops</h1>
          <p className="mt-1 text-sm text-neutral-500">Every shop on the platform, and its trial status.</p>
        </div>
        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" />
          New Shop
        </button>
      </div>

      {isLoading && (
        <div className="mt-10 flex justify-center">
          <Spinner />
        </div>
      )}

      {isError && (
        <div className="mt-6">
          <ErrorState message={getApiErrorMessage(error)} onRetry={() => refetch()} />
        </div>
      )}

      {shops && shops.length === 0 && (
        <div className="mt-10 flex flex-col items-center rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100">
            <Store className="h-6 w-6 text-neutral-400" />
          </div>
          <p className="mt-4 text-sm font-medium text-neutral-900">No shops yet</p>
          <p className="mt-1 text-sm text-neutral-500">Create your first shop to get started.</p>
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />
            New Shop
          </button>
        </div>
      )}

      {shops && shops.length > 0 && (
        <div className="mt-6 overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-xs font-medium uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3">Shop</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Products</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Trial Ends</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {shops.map((shop) => {
                const status = shopStatusBadge(shop);
                return (
                  <tr key={shop.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3">
                      <Link
                        to={`/super-admin/shops/${shop.id}`}
                        className="font-medium text-neutral-900 hover:text-brand-600"
                      >
                        {shop.name}
                      </Link>
                      <p className="text-xs text-neutral-400">/shop/{shop.slug}</p>
                    </td>
                    <td className="px-4 py-3 text-neutral-600">
                      {shop.owner ? shop.owner.email : <span className="text-neutral-400">No owner</span>}
                    </td>
                    <td className="px-4 py-3 text-neutral-600">{shop.product_count}</td>
                    <td className="px-4 py-3">
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={trialBadgeTone(shop.trial_status_label, shop.trial_days_remaining)}>
                        {shop.trial_status_label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-neutral-500">
                      {new Date(shop.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-3 text-sm font-medium">
                        <button
                          type="button"
                          onClick={() => navigate(`/super-admin/shops/${shop.id}`)}
                          className="text-neutral-600 hover:text-brand-600"
                        >
                          View
                        </button>
                        {shop.is_active ? (
                          <button
                            type="button"
                            onClick={() => setShopToDeactivate(shop)}
                            className="text-red-600 hover:text-red-700"
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleReactivate(shop)}
                            className="text-green-700 hover:text-green-800"
                          >
                            Activate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {isCreateOpen && (
        <ShopFormDialog
          onClose={() => setIsCreateOpen(false)}
          onCreated={(shopId) => {
            setIsCreateOpen(false);
            navigate(`/super-admin/shops/${shopId}`);
          }}
        />
      )}

      {shopToDeactivate && (
        <ConfirmDialog
          title="Deactivate shop"
          message={`This takes "${shopToDeactivate.name}"'s catalog offline for customers immediately. You can reactivate it at any time.`}
          confirmLabel="Deactivate"
          isDestructive
          isSubmitting={statusMutation.isPending}
          onConfirm={handleConfirmDeactivate}
          onCancel={() => setShopToDeactivate(null)}
        />
      )}
    </div>
  );
}
