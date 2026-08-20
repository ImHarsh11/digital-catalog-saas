import { useState, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createShop } from '@/services/superAdmin';
import { useToast } from '@/hooks/useToast';
import { getApiErrorMessage } from '@/utils/apiError';
import Modal from '@/components/Modal';
import type { ShopCreateInput } from '@/types/shop';

interface ShopFormDialogProps {
  onClose: () => void;
  onCreated: (shopId: number) => void;
}

const EMPTY_FORM: ShopCreateInput = {
  name: '',
  city: '',
  phone: '',
  address: '',
  website: '',
  description: '',
  owner_name: '',
  owner_email: '',
  owner_password: '',
};

const inputClass =
  'w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-neutral-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      <div className="mt-1">{children}</div>
      {hint && <span className="mt-1 block text-xs text-neutral-400">{hint}</span>}
    </label>
  );
}

export default function ShopFormDialog({ onClose, onCreated }: ShopFormDialogProps) {
  const [form, setForm] = useState<ShopCreateInput>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const mutation = useMutation({
    mutationFn: (payload: ShopCreateInput) => createShop(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'shops'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'dashboard'] });
      showToast('success', `${data.shop.name} was created with a 14-day trial.`);
      onCreated(data.shop.id);
    },
    onError: (err) => {
      setError(
        getApiErrorMessage(err, 'Could not create the shop. Please check the form and try again.'),
      );
    },
  });

  function update<K extends keyof ShopCreateInput>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    // Strip empty-string optional fields so we don't send "" for nullable columns.
    const payload: ShopCreateInput = {
      ...form,
      city: form.city || undefined,
      phone: form.phone || undefined,
      address: form.address || undefined,
      website: form.website || undefined,
      description: form.description || undefined,
    };
    mutation.mutate(payload);
  }

  return (
    <Modal title="New shop" onClose={onClose} widthClassName="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <fieldset className="space-y-3">
          <legend className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Shop details
          </legend>
          <Field label="Shop name" required>
            <input
              required
              type="text"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              className={inputClass}
              placeholder="e.g. Rina Fashions"
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
              rows={2}
              className={inputClass}
            />
          </Field>
        </fieldset>

        <fieldset className="space-y-3 border-t border-neutral-100 pt-4">
          <legend className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Owner account
          </legend>
          <Field label="Owner name" required>
            <input
              required
              type="text"
              value={form.owner_name}
              onChange={(e) => update('owner_name', e.target.value)}
              className={inputClass}
              placeholder="e.g. Priya Kumar"
            />
          </Field>
          <Field label="Owner email" required>
            <input
              required
              type="email"
              value={form.owner_email}
              onChange={(e) => update('owner_email', e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Temporary password" required hint="Share this with the shop owner.">
            <input
              required
              type="text"
              minLength={8}
              maxLength={72}
              value={form.owner_password}
              onChange={(e) => update('owner_password', e.target.value)}
              className={inputClass}
              placeholder="At least 8 characters"
            />
          </Field>
        </fieldset>

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
            {mutation.isPending ? 'Creating…' : 'Create shop'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
