import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createCategory, updateCategory } from '@/services/categories';
import { useToast } from '@/hooks/useToast';
import { getApiErrorMessage } from '@/utils/apiError';
import Modal from '@/components/Modal';
import type { Category } from '@/types/category';

interface CategoryFormDialogProps {
  shopId: number;
  category?: Category;
  onClose: () => void;
}

const inputClass =
  'w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-base text-neutral-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder-neutral-500';

export default function CategoryFormDialog({ shopId, category, onClose }: CategoryFormDialogProps) {
  const isEdit = Boolean(category);
  const [name, setName] = useState(category?.name ?? '');
  const [description, setDescription] = useState(category?.description ?? '');
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const mutation = useMutation({
    mutationFn: () =>
      isEdit
        ? updateCategory(shopId, category!.id, { name, description: description || undefined })
        : createCategory(shopId, { name, description: description || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shop-owner', 'categories', shopId] });
      showToast('success', isEdit ? 'Category updated.' : `"${name}" was added.`);
      onClose();
    },
    onError: (err) => {
      setError(getApiErrorMessage(err, 'Could not save this category. Please try again.'));
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    mutation.mutate();
  }

  return (
    <Modal title={isEdit ? 'Edit category' : 'New category'} onClose={onClose} widthClassName="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        <label className="block">
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Category name<span className="text-red-500"> *</span>
          </span>
          <input
            required
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`mt-1 ${inputClass}`}
            placeholder="e.g. Silk Sarees"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className={`mt-1 ${inputClass}`}
            placeholder="Optional"
          />
        </label>

        <div className="flex justify-end gap-2 border-t border-neutral-100 pt-4 dark:border-neutral-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3.5 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {mutation.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Add category'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
