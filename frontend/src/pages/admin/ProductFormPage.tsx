import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Info } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { listCategories } from '@/services/categories';
import { createProduct, getProduct, setProductStatus, updateProduct } from '@/services/products';
import { getApiErrorMessage } from '@/utils/apiError';
import Spinner from '@/components/Spinner';
import ErrorState from '@/components/ErrorState';
import ProductImageManager from '@/components/admin/ProductImageManager';
import type { Category } from '@/types/category';
import type { ProductDetail, ProductStatus } from '@/types/product';

const inputClass =
  'w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-base focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';

const STATUS_OPTIONS: Array<{ value: ProductStatus; label: string }> = [
  { value: 'AVAILABLE', label: 'Available' },
  { value: 'SOLD', label: 'Sold' },
  { value: 'OUT_OF_STOCK', label: 'Out of Stock' },
];

interface FormState {
  name: string;
  product_code: string;
  category_id: string;
  price: string;
  description: string;
  quantity_available: string;
  discount_percent: string;
}

function initialFormState(product: ProductDetail | undefined): FormState {
  if (!product) {
    return { name: '', product_code: '', category_id: '', price: '', description: '', quantity_available: '1', discount_percent: '' };
  }
  return {
    name: product.name,
    product_code: product.product_code ?? '',
    category_id: String(product.category.id),
    price: String(product.price),
    description: product.description ?? '',
    quantity_available: String(product.quantity_available ?? 1),
    discount_percent: product.discount_percent != null ? String(product.discount_percent) : '',
  };
}

export default function ProductFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const productId = id ? Number(id) : undefined;

  const { shop } = useAuth();
  const shopId = shop?.id as number;

  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ['shop-owner', 'categories', shopId],
    queryFn: () => listCategories(shopId),
    enabled: Number.isFinite(shopId),
  });

  const {
    data: product,
    isLoading: productLoading,
    isError: productError,
    error: productErrorObj,
    refetch: refetchProduct,
  } = useQuery({
    queryKey: ['shop-owner', 'product', shopId, productId],
    queryFn: () => getProduct(shopId, productId as number),
    enabled: isEdit && Number.isFinite(shopId) && Number.isFinite(productId),
  });

  if (isEdit && productLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (isEdit && (productError || !product)) {
    return (
      <ErrorState
        title="Couldn't load this product"
        message={getApiErrorMessage(productErrorObj, 'This product could not be found.')}
        onRetry={() => refetchProduct()}
      />
    );
  }

  return (
    <ProductFormFields
      // Fresh state per product -- remounts (and re-derives initial state
      // straight from `product`, no effect needed) if we ever navigate
      // from one product's edit page directly to another's.
      key={product?.id ?? 'new'}
      shopId={shopId}
      isEdit={isEdit}
      productId={productId}
      product={product}
      categories={categories}
      categoriesLoading={categoriesLoading}
    />
  );
}

interface ProductFormFieldsProps {
  shopId: number;
  isEdit: boolean;
  productId: number | undefined;
  product: ProductDetail | undefined;
  categories: Category[] | undefined;
  categoriesLoading: boolean;
}

function ProductFormFields({
  shopId,
  isEdit,
  productId,
  product,
  categories,
  categoriesLoading,
}: ProductFormFieldsProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [form, setForm] = useState<FormState>(() => initialFormState(product));
  const [status, setStatus] = useState<ProductStatus>(product?.status ?? 'AVAILABLE');
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof FormState>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const createMutation = useMutation({
    mutationFn: () =>
      createProduct(shopId, {
        name: form.name,
        product_code: form.product_code || undefined,
        category_id: Number(form.category_id),
        price: Number(form.price),
        description: form.description || undefined,
        quantity_available: Number(form.quantity_available) || 1,
        discount_percent: form.discount_percent ? Number(form.discount_percent) : null,
      }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['shop-owner', 'products', shopId] });
      queryClient.invalidateQueries({ queryKey: ['shop-owner', 'dashboard', shopId] });
      showToast('success', `${created.name} was added. Now add some photos!`);
      navigate(`/admin/products/${created.id}/edit`, { replace: true });
    },
    onError: (err) => {
      setError(getApiErrorMessage(err, 'Could not create this product. Please check the form and try again.'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      await updateProduct(shopId, productId as number, {
        name: form.name,
        product_code: form.product_code || undefined,
        category_id: Number(form.category_id),
        price: Number(form.price),
        description: form.description || undefined,
        quantity_available: Number(form.quantity_available) || 1,
        discount_percent: form.discount_percent ? Number(form.discount_percent) : null,
      });
      if (product && status !== product.status) {
        await setProductStatus(shopId, productId as number, status);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shop-owner', 'product', shopId, productId] });
      queryClient.invalidateQueries({ queryKey: ['shop-owner', 'products', shopId] });
      queryClient.invalidateQueries({ queryKey: ['shop-owner', 'dashboard', shopId] });
      showToast('success', 'Product saved.');
    },
    onError: (err) => {
      setError(getApiErrorMessage(err, 'Could not save these changes. Please try again.'));
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (isEdit) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const noCategoriesYet = categories && categories.length === 0;

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        to="/admin/products"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-neutral-700"
      >
        <ArrowLeft className="h-4 w-4" />
        All products
      </Link>

      <h1 className="mt-3 text-xl font-semibold text-neutral-900">
        {isEdit ? 'Edit product' : 'Add a product'}
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        {isEdit
          ? 'Update the details below and save your changes.'
          : "Fill in the basics -- you can add photos right after you save."}
      </p>

      {noCategoriesYet && (
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            You need at least one category before adding products.{' '}
            <Link to="/admin/categories" className="font-medium underline underline-offset-2">
              Create a category
            </Link>{' '}
            first.
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4 rounded-xl border border-neutral-200 bg-white p-5">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        <label className="block">
          <span className="text-sm font-medium text-neutral-700">
            Product name<span className="text-red-500"> *</span>
          </span>
          <input
            required
            type="text"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            className={`mt-1 ${inputClass}`}
            placeholder="e.g. Banarasi Silk Saree"
          />
        </label>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-neutral-700">
              Category<span className="text-red-500"> *</span>
            </span>
            <select
              required
              value={form.category_id}
              onChange={(e) => update('category_id', e.target.value)}
              disabled={categoriesLoading || noCategoriesYet}
              className={`mt-1 ${inputClass}`}
            >
              <option value="" disabled>
                Select a category
              </option>
              {categories?.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-neutral-700">
              Price (₹)<span className="text-red-500"> *</span>
            </span>
            <input
              required
              type="number"
              min="0.01"
              step="0.01"
              value={form.price}
              onChange={(e) => update('price', e.target.value)}
              className={`mt-1 ${inputClass}`}
              placeholder="e.g. 4500"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-neutral-700">
              Quantity available<span className="text-red-500"> *</span>
            </span>
            <input
              required
              type="number"
              min="0"
              step="1"
              value={form.quantity_available}
              onChange={(e) => update('quantity_available', e.target.value)}
              className={`mt-1 ${inputClass}`}
              placeholder="e.g. 5"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-neutral-700">Discount (%)</span>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={form.discount_percent}
              onChange={(e) => update('discount_percent', e.target.value)}
              className={`mt-1 ${inputClass}`}
              placeholder="e.g. 10 for 10% off (optional)"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-neutral-700">Product code</span>
          <input
            type="text"
            value={form.product_code}
            onChange={(e) => update('product_code', e.target.value)}
            className={`mt-1 ${inputClass}`}
            placeholder="Optional -- your own stock number, if you use one"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-neutral-700">Description</span>
          <textarea
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            rows={3}
            className={`mt-1 ${inputClass}`}
            placeholder="A short description customers will see (optional)"
          />
        </label>

        {isEdit && (
          <div>
            <span className="text-sm font-medium text-neutral-700">Status</span>
            <div className="mt-1 flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setStatus(option.value)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    status === option.value
                      ? 'border-brand-600 bg-brand-50 text-brand-700'
                      : 'border-neutral-300 text-neutral-600 hover:bg-neutral-50'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-neutral-100 pt-4">
          <Link
            to="/admin/products"
            className="rounded-lg px-3.5 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSaving || noCategoriesYet}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {isSaving ? 'Saving…' : isEdit ? 'Save changes' : 'Create product'}
          </button>
        </div>
      </form>

      {isEdit && product && (
        <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-5">
          <ProductImageManager
            shopId={shopId}
            productId={product.id}
            images={product.images}
            primaryImageUrl={product.primary_image_url}
          />
        </div>
      )}
    </div>
  );
}
