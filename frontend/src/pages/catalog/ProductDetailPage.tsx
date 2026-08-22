import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { ArrowLeft, Share2 } from 'lucide-react';
import { getShopProduct } from '@/services/publicCatalog';
import { customerStatusBadge } from '@/utils/customerProductStatus';
import { formatPrice } from '@/utils/currency';
import { useToast } from '@/hooks/useToast';
import ProductImage from '@/components/catalog/ProductImage';
import Spinner from '@/components/Spinner';
import Badge from '@/components/Badge';
import CatalogUnavailablePage from './CatalogUnavailablePage';
import type { PublicProductImage } from '@/types/publicCatalog';

export default function ProductDetailPage() {
  const { shopSlug, productId } = useParams<{ shopSlug: string; productId: string }>();
  const slug = shopSlug ?? '';
  const id = Number(productId);
  const { showToast } = useToast();
  const [activeImage, setActiveImage] = useState(0);

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
    <div className="min-h-screen bg-neutral-50 pb-16">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
        <Link
          to={`/shop/${slug}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to catalog
        </Link>
        <button
          type="button"
          onClick={handleShare}
          className="inline-flex items-center gap-1.5 rounded-full border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          <Share2 className="h-3.5 w-3.5" />
          Share
        </button>
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
          <p className="mt-4 text-2xl font-semibold text-neutral-900">{formatPrice(product.price)}</p>

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
    </div>
  );
}
