import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addSelectionItem,
  getSelection,
  removeSelectionItem,
  updateSelectionNote,
} from '@/services/publicCatalog';
import type { PublicSelection } from '@/types/publicCatalog';

/**
 * The customer's device-keyed "My Selection" shortlist for one shop.
 * No login — the list is scoped by the persistent `dc_device_id` header.
 * All mutations write the server's returned selection straight into the
 * cache so the "＋ Add" buttons and the floating bar update instantly.
 */
export function useSelection(shopSlug: string) {
  const qc = useQueryClient();
  const key = ['public', 'selection', shopSlug];

  const query = useQuery({
    queryKey: key,
    queryFn: () => getSelection(shopSlug),
    enabled: Boolean(shopSlug),
    staleTime: 30_000,
  });

  const put = (data: PublicSelection) => qc.setQueryData(key, data);

  const add = useMutation({
    mutationFn: (vars: { productId: number; note?: string }) =>
      addSelectionItem(shopSlug, vars.productId, vars.note),
    onSuccess: put,
  });

  const remove = useMutation({
    mutationFn: (productId: number) => removeSelectionItem(shopSlug, productId),
    onSuccess: put,
  });

  const setNote = useMutation({
    mutationFn: (vars: { productId: number; note: string }) =>
      updateSelectionNote(shopSlug, vars.productId, vars.note),
    onSuccess: put,
  });

  const items = query.data?.items ?? [];
  const ids = new Set(items.map((i) => i.product.id));
  const has = useCallback((productId: number) => ids.has(productId), [ids]);

  const toggle = useCallback(
    (productId: number) => {
      if (ids.has(productId)) remove.mutate(productId);
      else add.mutate({ productId });
    },
    [ids, add, remove],
  );

  return {
    selection: query.data ?? null,
    items,
    count: query.data?.count ?? 0,
    contactCaptured: query.data?.contact_captured ?? false,
    isLoading: query.isLoading,
    has,
    toggle,
    add,
    remove,
    setNote,
    pending: add.isPending || remove.isPending,
  };
}
