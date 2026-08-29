import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { ArrowLeft, Heart, Share2 } from 'lucide-react';
import {
  getProductLikeStatus,
  getShopCatalog,
  getShopProduct,
  toggleProductLike,
} from '@/services/publicCatalog';
import { customerStatusBadge } from '@/utils/customerProductStatus';
import { effectivePrice, formatPrice } from '@/utils/currency';
import { useToast } from '@/hooks/useToast';
import ProductImage from '@/components/catalog/ProductImage';
import Spinner from '@/components/Spinner';
import Badge from '@/components/Badge';
import CatalogThemeProvider from '@/components/catalog/CatalogThemeProvider';
import SelectionButton from '@/components/catalog/SelectionButton';
import CatalogUnavailablePage from './CatalogUnavailablePage';
import type { PublicProductImage } from '@/types/publicCatalog';

export default function ProductDetailPage() {
  const { shopSlug, productId } = useParams<{ shopSlug: string; productId: string }>();
  const slug = shopSlug ?? '';
  const id = Number(productId);
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [activeImage, setActiveImage] = useState(0);

  const { data: shopData } = useQuery({
    queryKey: ['public', 'shop', slug],
    queryFn: () => getShopCatalog(slug),
    enabled: Boolean(slug),
    retry: false,
  });

  const { data: likeStatus } = useQuery({
    queryKey: ['public', 'like', slug, id],
    queryFn: () => getProductLikeStatus(slug, id),
    enabled: Boolean(slug) && Number.isFinite(id),
  });

  const likeMutation = useMutation({
    mutationFn: () => toggleProductLike(slug, id),
    onSuccess: (result) => {
      queryClient.setQueryData(['public', 'like', slug, id], result);
    },
  });

  const {
    data,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['public', 'product', slug, id],
    queryFn: () => getShopProduct(slug, id),
    enabled: Boolean(slug) && Number.isFinite(id),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50">
        <Spinner />
      </div>
    );
  }

  if (isError) {
    const status = error instanceof AxiosError ? error.response?.status : undefined;
    if (status === 403) {
      return (
        <CatalogUnavailablePage
          title="This catalog is currently unavailable."
          message="Please check back later, or contact the shop directly."
        />
      );
    }
    return (
      <CatalogUnavailablePage
        title="We couldn't find this product."
        message="It may have been removed, or the link may be incorrect."
      />
    );
  }

  if (!data) {
    return null;
  }

  // Re-bound to a non-nullable const so it stays narrowed inside the
  // `handleShare` closure below (a plain `data` reference from the query
  // result wouldn't retain the narrowing across a nested function).
  const product = data;

  const images: PublicProductImage[] =
    product.images.length > 0
      ? product.images
      : product.primary_image_url
        ? [{ id: 0, image_url: product.primary_image_url, display_order: 0 }]
        : [];
  const activeUrl = images.length > 0 ? images[Math.min(activeImage, images.length - 1)].image_url : null;
  const badge = customerStatusBadge(product.status);

  async function handleShare() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: product.name, text: `Check out ${product.name}`, url });
      } catch (err) {
        // AbortError just means the customer closed the native share sheet.
        if (err instanceof Error && err.name !== 'AbortError') {
          showToast('error', 'Could not share this product.');
        }
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast('success', 'Product link copied!');
    } catch {
      showToast('error', 'Could not copy the link.');
    }
  }

  return (
    <CatalogThemeProvider theme={shopData?.theme}>
    <div className="pb-28" style={{ background: 'var(--catalog-bg)' }}>
      <div className="sticky top-0 z-10 flex items-center justify-between border-b px-4 py-3 backdrop-blur sm:px-6" style={{ borderColor: 'var(--catalog-hairline)', background: 'color-mix(in srgb, var(--catalog-card) 92%, transparent)' }}>
        <Link
          to={`/shop/${slug}`}
          state={{ skipSplash: true }}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to catalog
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => likeMutation.mutate()}
            disabled={likeMutation.isPending}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              likeStatus?.liked
                ? 'border-red-200 bg-red-50 text-red-600'
                : 'border-neutral-300 text-neutral-700 hover:bg-neutral-50'
            }`}
          >
            <Heart className={`h-3.5 w-3.5 ${likeStatus?.liked ? 'fill-red-500 text-red-500' : ''}`} />
            {likeStatus?.like_count ?? 0}
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 rounded-full border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            <Share2 className="h-3.5 w-3.5" />
            Share
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 pt-4 sm:px-6">
        <div className="relative aspect-square w-full overflow-hidden rounded-xl">
          <ProductImage src={activeUrl} alt={product.name} className="h-full w-full" iconClassName="h-14 w-14" eager />
          {product.status !== 'AVAILABLE' && (
            <div className="absolute left-3 top-3">
              <Badge tone={badge.tone}>{badge.label}</Badge>
            </div>
          )}
        </div>

        {images.length > 1 && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {images.map((image, index) => (
              <button
                key={image.id}
                type="button"
                onClick={() => setActiveImage(index)}
                className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 ${
                  index === activeImage ? 'border-brand-600' : 'border-transparent'
                }`}
              >
                <ProductImage
                  src={image.image_url}
                  alt={`${product.name} ${index + 1}`}
                  className="h-full w-full"
                  iconClassName="h-5 w-5"
                />
              </button>
            ))}
          </div>
        )}

        <div className="mt-6">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-lg font-semibold text-neutral-900 sm:text-xl">{product.name}</h1>
            {product.status === 'AVAILABLE' && (
              <span className="shrink-0">
                <Badge tone={badge.tone}>{badge.label}</Badge>
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-neutral-500">{product.category.name}</p>
          {product.product_code && <p className="mt-0.5 text-xs text-neutral-400">Code: {product.product_code}</p>}
          {(product.color || product.brand) && (
            <div className="mt-2 flex flex-wrap gap-2">
              {product.brand && (
                <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-600">
                  {product.brand}
                </span>
              )}
              {product.color && (
                <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-600">
                  {product.color}
                </span>
              )}
            </div>
          )}
          {product.discount_percent ? (
            <div className="mt-4 flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-brand-700">
                  {formatPrice(effectivePrice(product.price, product.discount_percent))}
                </span>
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700">
                  {Math.round(product.discount_percent)}% off
                </span>
              </div>
              <span className="text-sm text-neutral-400 line-through">{formatPrice(product.price)}</span>
            </div>
          ) : (
            <p className="mt-4 text-2xl font-semibold text-neutral-900">{formatPrice(product.price)}</p>
          )}

          {product.description && (
            <div className="mt-6 border-t border-neutral-200 pt-5">
              <h2 className="text-sm font-semibold text-neutral-900">Description</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-neutral-600">
                {product.description}
              </p>
            </div>
          )}
        </div>
      </div>

      {product.status === 'AVAILABLE' && (
        <div
          className="fixed inset-x-0 bottom-0 z-20 border-t px-4 py-3 backdrop-blur sm:px-6"
          style={{
            borderColor: 'var(--catalog-hairline)',
            background: 'color-mix(in srgb, var(--catalog-card) 92%, transparent)',
          }}
        >
          <div className="mx-auto max-w-3xl">
            <SelectionButton slug={slug} productId={product.id} variant="full" />
            <p className="mt-1.5 text-center text-xs" style={{ color: 'var(--catalog-ink-muted)' }}>
              Build a shortlist, then show it to the shop staff for a physical look.
            </p>
          </div>
        </div>
      )}
    </div>
    </CatalogThemeProvider>
  );
}
