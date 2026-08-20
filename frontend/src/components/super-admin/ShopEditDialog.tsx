import { useState, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateShop } from '@/services/superAdmin';
import { useToast } from '@/hooks/useToast';
import { getApiErrorMessage } from '@/utils/apiError';
import Modal from '@/components/Modal';
import type { ShopDetail, ShopUpdateInput } from '@/types/shop';

interface ShopEditDialogProps {
  shop: ShopDetail;
  onClose: () => void;
}

const inputClass =
  'w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-neutral-700">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

export default function ShopEditDialog({ shop, onClose }: ShopEditDialogProps) {
  const [form, setForm] = useState<Required<ShopUpdateInput>>({
    name: shop.name,
    city: shop.city ?? '',
    phone: shop.phone ?? '',
    address: shop.address ?? '',
    website: shop.website ?? '',
    description: shop.description ?? '',
    logo_url: shop.logo_url ?? '',
  });
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const mutation = useMutation({
    mutationFn: (payload: ShopUpdateInput) => updateShop(shop.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'shops', shop.id] });
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'shops'] });
      showToast('success', 'Shop details updated.');
      onClose();
    },
    onError: (err) => {
      setError(getApiErrorMessage(err, 'Could not save these changes. Please try again.'));
    },
  });

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    mutation.mutate({
      name: form.name,
      city: form.city || undefined,
      phone: form.phone || undefined,
      address: form.address || undefined,
      website: form.website || undefined,
      description: form.description || undefined,
      logo_url: form.logo_url || undefined,
    });
  }

  return (
    <Modal title="Edit shop" onClose={onClose} widthClassName="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <Field label="Shop name">
          <input
            required
            type="text"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            className={inputClass}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="City">
            <input
              type="text"
              value={form.city}
              onChange={(e) => update('city', e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Phone">
            <input
              type="text"
              value={form.phone}
              onChange={(e) => update('phone', e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>
        <Field label="Address">
          <input
            type="text"
            value={form.address}
            onChange={(e) => update('address', e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Website">
          <input
            type="text"
            value={form.website}
            onChange={(e) => update('website', e.target.value)}
            className={inputClass}
            placeholder="https://"
          />
        </Field>
        <Field label="Description">
          <textarea
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            rows={3}
            className={inputClass}
          />
        </Field>

        <div className="flex justify-end gap-2 border-t border-neutral-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3.5 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {mutation.isPending ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
