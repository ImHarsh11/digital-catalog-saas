import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Tags, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { deleteCategory, listCategories } from '@/services/categories';
import { getApiErrorMessage } from '@/utils/apiError';
import Spinner from '@/components/Spinner';
import ErrorState from '@/components/ErrorState';
import Badge from '@/components/Badge';
import ConfirmDialog from '@/components/ConfirmDialog';
import CategoryFormDialog from '@/components/admin/CategoryFormDialog';
import type { Category } from '@/types/category';

export default function CategoriesPage() {
  const { shop } = useAuth();
  const shopId = shop?.id as number;
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [categoryToEdit, setCategoryToEdit] = useState<Category | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);

  const {
    data: categories,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['shop-owner', 'categories', shopId],
    queryFn: () => listCategories(shopId),
    enabled: Number.isFinite(shopId),
  });

  const deleteMutation = useMutation({
    mutationFn: (categoryId: number) => deleteCategory(shopId, categoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shop-owner', 'categories', shopId] });
      showToast('success', `"${categoryToDelete?.name}" was deleted.`);
      setCategoryToDelete(null);
    },
    onError: (err) => {
      showToast(
        'error',
        getApiErrorMessage(err, 'Could not delete this category. Please try again.'),
      );
      setCategoryToDelete(null);
    },
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Categories</h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Group your products so customers can browse by type.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" />
          New Category
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

      {categories && categories.length === 0 && (
        <div className="mt-10 flex flex-col items-center rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-14 text-center dark:border-neutral-700 dark:bg-neutral-900">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
            <Tags className="h-6 w-6 text-neutral-400" />
          </div>
          <p className="mt-4 text-sm font-medium text-neutral-900 dark:text-neutral-100">No categories yet</p>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Create a category (like "Silk Sarees" or "Lehengas") before adding products.
          </p>
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />
            New Category
          </button>
        </div>
      )}

      {categories && categories.length > 0 && (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <div
              key={category.id}
              className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-neutral-900 dark:text-neutral-100">{category.name}</p>
                  {category.description && (
                    <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{category.description}</p>
                  )}
                </div>
                <Badge tone={category.product_count > 0 ? 'blue' : 'neutral'}>
                  {category.product_count} {category.product_count === 1 ? 'product' : 'products'}
                </Badge>
              </div>
              <div className="mt-4 flex gap-2 border-t border-neutral-100 pt-3 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setCategoryToEdit(category)}
                  className="inline-flex items-center gap-1 rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryToDelete(category)}
                  className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isCreateOpen && <CategoryFormDialog shopId={shopId} onClose={() => setIsCreateOpen(false)} />}

      {categoryToEdit && (
        <CategoryFormDialog shopId={shopId} category={categoryToEdit} onClose={() => setCategoryToEdit(null)} />
      )}

      {categoryToDelete && (
        <ConfirmDialog
          title="Delete category"
          message={
            categoryToDelete.product_count > 0
              ? `"${categoryToDelete.name}" has ${categoryToDelete.product_count} product(s) assigned. Move or delete them first, then you can delete this category.`
              : `This permanently deletes "${categoryToDelete.name}". This cannot be undone.`
          }
          confirmLabel="Delete"
          isDestructive
          isSubmitting={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(categoryToDelete.id)}
          onCancel={() => setCategoryToDelete(null)}
        />
      )}
    </div>
  );
}
