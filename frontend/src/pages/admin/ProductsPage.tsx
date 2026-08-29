import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ImageOff, Minus, Package, Pencil, Plus, RotateCcw, Search, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { listCategories } from '@/services/categories';
import { adjustProductStock, deleteProduct, listProducts, setProductStatus } from '@/services/products';
import { getApiErrorMessage } from '@/utils/apiError';
import { formatPrice } from '@/utils/currency';
import { productStatusBadge } from '@/utils/productStatus';
import Spinner from '@/components/Spinner';
import ErrorState from '@/components/ErrorState';
import Badge from '@/components/Badge';
import ConfirmDialog from '@/components/ConfirmDialog';
import type { ProductListItem, ProductStatus } from '@/types/product';

const STATUS_OPTIONS: Array<{ value: ProductStatus | ''; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'AVAILABLE', label: 'Available' },
  { value: 'SOLD', label: 'Sold' },
  { value: 'OUT_OF_STOCK', label: 'Out of Stock' },
];

export default function ProductsPage() {
  const { shop } = useAuth();
  const shopId = shop?.id as number;
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [status, setStatus] = useState<ProductStatus | ''>('');
  const [productToDelete, setProductToDelete] = useState<ProductListItem | null>(null);

  // Small debounce so we're not re-querying on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data: categories } = useQuery({
    queryKey: ['shop-owner', 'categories', shopId],
    queryFn: () => listCategories(shopId),
    enabled: Number.isFinite(shopId),
  });

  const {
    data: products,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['shop-owner', 'products', shopId, { categoryId, status, search }],
    queryFn: () =>
      listProducts(shopId, {
        categoryId: categoryId || undefined,
        status: status || undefined,
        search: search || undefined,
      }),
    enabled: Number.isFinite(shopId),
  });

  const statusMutation = useMutation({
    mutationFn: ({ productId, newStatus }: { productId: number; newStatus: ProductStatus }) =>
      setProductStatus(shopId, productId, newStatus),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['shop-owner', 'products', shopId] });
      queryClient.invalidateQueries({ queryKey: ['shop-owner', 'dashboard', shopId] });
      showToast(
        'success',
        updated.status === 'SOLD' ? `${updated.name} marked as sold.` : `${updated.name} marked as available.`,
      );
    },
    onError: (err) => {
      showToast('error', getApiErrorMessage(err, 'Could not update the product status.'));
    },
  });

  const stockMutation = useMutation({
    mutationFn: ({ productId, action }: { productId: number; action: 'sell' | 'add' }) =>
      adjustProductStock(shopId, productId, action),
    onSuccess: (updated, vars) => {
      queryClient.invalidateQueries({ queryKey: ['shop-owner', 'products', shopId] });
      queryClient.invalidateQueries({ queryKey: ['shop-owner', 'dashboard', shopId] });
      if (vars.action === 'sell') {
        showToast(
          'success',
          updated.status === 'SOLD'
            ? `${updated.name} — last piece sold, now off the catalog.`
            : `Sold one ${updated.name}. ${updated.quantity_available} left.`,
        );
      } else {
        showToast('success', `${updated.name} restocked — ${updated.quantity_available} in stock.`);
      }
    },
    onError: (err) => showToast('error', getApiErrorMessage(err, 'Could not update stock.')),
  });

  const deleteMutation = useMutation({
    mutationFn: (productId: number) => deleteProduct(shopId, productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shop-owner', 'products', shopId] });
      queryClient.invalidateQueries({ queryKey: ['shop-owner', 'dashboard', shopId] });
      showToast('success', `${productToDelete?.name} was deleted.`);
      setProductToDelete(null);
    },
    onError: (err) => {
      showToast('error', getApiErrorMessage(err, 'Could not delete this product.'));
    },
  });

  const hasFilters = Boolean(search || categoryId || status);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900 dark:text-white">Products</h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Manage what's in your catalog.</p>
        </div>
        <Link
          to="/admin/products/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" />
          Add Product
        </Link>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name or product code..."
            className="w-full rounded-lg border border-neutral-300 bg-white py-2 pl-9 pr-3 text-sm text-neutral-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-neutral-600 dark:bg-neutral-800 dark:text-white dark:placeholder-neutral-400"
          />
        </div>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : '')}
          className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-neutral-600 dark:bg-neutral-800 dark:text-white"
        >
          <option value="">All categories</option>
          {categories?.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as ProductStatus | '')}
          className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-neutral-600 dark:bg-neutral-800 dark:text-white"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
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

      {products && products.length === 0 && !hasFilters && (
        <div className="mt-10 flex flex-col items-center rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-14 text-center dark:border-neutral-700 dark:bg-neutral-900">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
            <Package className="h-6 w-6 text-neutral-400" />
          </div>
          <p className="mt-4 text-sm font-medium text-neutral-900 dark:text-neutral-100">No products yet</p>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Add your first product to start building your catalog.</p>
          <Link
            to="/admin/products/new"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />
            Add Product
          </Link>
        </div>
      )}

      {products && products.length === 0 && hasFilters && (
        <div className="mt-10 flex flex-col items-center rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-14 text-center dark:border-neutral-700 dark:bg-neutral-900">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
            <Search className="h-6 w-6 text-neutral-400" />
          </div>
          <p className="mt-4 text-sm font-medium text-neutral-900 dark:text-neutral-100">No products match your filters</p>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Try a different search or clear the filters.</p>
        </div>
      )}

      {products && products.length > 0 && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => {
            const badge = productStatusBadge(product.status);
            return (
              <div key={product.id} className="flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
                <div className="flex h-40 items-center justify-center bg-neutral-100 dark:bg-neutral-800">
                  {product.primary_image_url ? (
                    <img
                      src={product.primary_image_url}
                      alt={product.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <ImageOff className="h-8 w-8 text-neutral-300" />
                  )}
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-neutral-900 dark:text-white">{product.name}</p>
                      {product.product_code && (
                        <p className="text-xs text-neutral-400">Code: {product.product_code}</p>
                      )}
                    </div>
                    <Badge tone={badge.tone}>{badge.label}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{product.category.name}</p>
                  <p className="mt-2 text-lg font-semibold text-neutral-900 dark:text-white">{formatPrice(product.price)}</p>
                  {product.created_by && (
                    <p className="mt-1 text-xs text-neutral-400">
                      Added by {product.created_by.role === 'SUPER_ADMIN' ? 'Catalog Team' : product.created_by.name}
                    </p>
                  )}

                  {/* Stock control — "−" records a sale (auto-Sold at 0), "+" restocks */}
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      aria-label="Record a sale"
                      onClick={() => stockMutation.mutate({ productId: product.id, action: 'sell' })}
                      disabled={stockMutation.isPending || product.quantity_available === 0}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-neutral-300 text-neutral-600 hover:bg-neutral-50 disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="min-w-[4.5rem] text-center text-sm font-medium tabular-nums text-neutral-800 dark:text-neutral-200">
                      {product.status === 'SOLD' ? 'Sold out' : `${product.quantity_available} in stock`}
                    </span>
                    <button
                      type="button"
                      aria-label="Add stock"
                      onClick={() => stockMutation.mutate({ productId: product.id, action: 'add' })}
                      disabled={stockMutation.isPending}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-neutral-300 text-neutral-600 hover:bg-neutral-50 disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="mt-1 text-[11px] text-neutral-400">
                    Tap <span className="font-semibold">−</span> each time a piece sells
                  </p>

                  <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
                    <Link
                      to={`/admin/products/${product.id}/edit`}
                      className="inline-flex items-center gap-1 rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Link>
                    {product.status === 'OUT_OF_STOCK' && (
                      <button
                        type="button"
                        onClick={() => statusMutation.mutate({ productId: product.id, newStatus: 'AVAILABLE' })}
                        disabled={statusMutation.isPending}
                        className="inline-flex items-center gap-1 rounded-lg border border-green-200 px-2.5 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50 disabled:opacity-60 dark:border-green-900 dark:text-green-400 dark:hover:bg-green-950"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Back in stock
                      </button>
                    )}
                    {product.status === 'AVAILABLE' && (
                      <button
                        type="button"
                        onClick={() => statusMutation.mutate({ productId: product.id, newStatus: 'OUT_OF_STOCK' })}
                        disabled={statusMutation.isPending}
                        className="inline-flex items-center gap-1 rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                      >
                        Hide (out of stock)
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setProductToDelete(product)}
                      className="ml-auto inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {productToDelete && (
        <ConfirmDialog
          title="Delete product"
          message={`This permanently deletes "${productToDelete.name}" and all of its photos. This cannot be undone.`}
          confirmLabel="Delete"
          isDestructive
          isSubmitting={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(productToDelete.id)}
          onCancel={() => setProductToDelete(null)}
        />
      )}
    </div>
  );
}
