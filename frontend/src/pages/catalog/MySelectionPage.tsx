import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Check, Heart, Pencil, Trash2, X } from 'lucide-react';
import { getShopCatalog } from '@/services/publicCatalog';
import { useSelection } from '@/hooks/useSelection';
import { formatPrice } from '@/utils/currency';
import ProductImage from '@/components/catalog/ProductImage';
import Spinner from '@/components/Spinner';
import CatalogThemeProvider from '@/components/catalog/CatalogThemeProvider';
import CustomerContactSheet, { contactPromptDone } from '@/components/catalog/CustomerContactSheet';

export default function MySelectionPage() {
  const { shopSlug } = useParams<{ shopSlug: string }>();
  const slug = shopSlug ?? '';

  const { data: catalog } = useQuery({
    queryKey: ['public', 'shop', slug],
    queryFn: () => getShopCatalog(slug),
    enabled: Boolean(slug),
    retry: false,
  });

  const { items, count, contactCaptured, isLoading, remove, setNote } = useSelection(slug);
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [showSheet, setShowSheet] = useState(false);

  function startEdit(productId: number, current: string | null) {
    setEditing(productId);
    setDraft(current ?? '');
  }
  function saveEdit(productId: number) {
    setNote.mutate({ productId, note: draft.trim() });
    setEditing(null);
  }

  return (
    <CatalogThemeProvider theme={catalog?.theme}>
      <div className="min-h-screen pb-28" style={{ background: 'var(--catalog-bg)', color: 'var(--catalog-ink)' }}>
        <header
          className="sticky top-0 z-10 flex items-center gap-3 border-b px-4 py-3 backdrop-blur sm:px-6"
          style={{
            borderColor: 'var(--catalog-hairline)',
            background: 'color-mix(in srgb, var(--catalog-card) 92%, transparent)',
          }}
        >
          <Link
            to={`/shop/${slug}`}
            state={{ skipSplash: true }}
            className="inline-flex items-center gap-1.5 text-sm font-medium"
            style={{ color: 'var(--catalog-ink-muted)' }}
          >
            <ArrowLeft className="h-4 w-4" />
            Catalog
          </Link>
        </header>

        <div className="mx-auto max-w-2xl px-4 pt-6 sm:px-6">
          <div className="flex items-center gap-2">
            <Heart className="h-5 w-5" style={{ color: 'var(--catalog-primary)' }} />
            <h1 className="text-xl font-semibold" style={{ fontFamily: 'var(--catalog-heading-font)' }}>
              My Selection
            </h1>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-20">
              <Spinner />
            </div>
          ) : count === 0 ? (
            <div
              className="mt-6 flex flex-col items-center rounded-3xl border border-dashed px-6 py-16 text-center"
              style={{ borderColor: 'var(--catalog-hairline)', background: 'var(--catalog-card)' }}
            >
              <Heart className="h-8 w-8" style={{ color: 'var(--catalog-ink-muted)' }} />
              <p className="mt-3 text-sm font-medium">Nothing picked yet</p>
              <p className="mt-1 text-xs" style={{ color: 'var(--catalog-ink-muted)' }}>
                Tap “Add” on anything you like. Then show this screen to the shop staff.
              </p>
              <Link
                to={`/shop/${slug}`}
                state={{ skipSplash: true }}
                className="mt-4 rounded-full px-5 py-2.5 text-sm font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, var(--catalog-primary), var(--catalog-accent))' }}
              >
                Browse the catalog
              </Link>
            </div>
          ) : (
            <>
              <div
                className="mt-4 rounded-2xl px-4 py-3 text-sm"
                style={{ background: 'var(--catalog-accent-soft)', color: 'var(--catalog-primary)' }}
              >
                <strong>Show this screen to the shop staff</strong> for a physical look at these{' '}
                {count} item{count === 1 ? '' : 's'}. No code or QR needed.
              </div>

              <ul className="mt-4 space-y-3">
                {items.map(({ product, note }) => (
                  <li
                    key={product.id}
                    className="flex gap-3 rounded-2xl p-3"
                    style={{ background: 'var(--catalog-card)', border: '1px solid var(--catalog-hairline)' }}
                  >
                    <Link
                      to={`/shop/${slug}/product/${product.id}`}
                      className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-neutral-100"
                    >
                      <ProductImage src={product.primary_image_url} alt={product.name} className="h-full w-full" />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-medium leading-snug">{product.name}</p>
                      <p className="mt-0.5 text-xs" style={{ color: 'var(--catalog-ink-muted)' }}>
                        {product.category.name}
                        {product.product_code ? ` · ${product.product_code}` : ''}
                      </p>
                      <p className="mt-0.5 text-sm font-semibold" style={{ color: 'var(--catalog-primary)' }}>
                        {formatPrice(product.price)}
                      </p>

                      {editing === product.id ? (
                        <div className="mt-2 flex items-center gap-1.5">
                          <input
                            autoFocus
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            maxLength={255}
                            placeholder="e.g. size M, in blue"
                            className="min-w-0 flex-1 rounded-lg border px-2.5 py-1.5 text-xs focus:outline-none"
                            style={{ borderColor: 'var(--catalog-hairline)', background: 'var(--catalog-bg)' }}
                          />
                          <button
                            type="button"
                            onClick={() => saveEdit(product.id)}
                            className="rounded-lg p-1.5 text-white"
                            style={{ background: 'var(--catalog-primary)' }}
                            aria-label="Save note"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditing(null)}
                            className="rounded-lg p-1.5"
                            style={{ color: 'var(--catalog-ink-muted)' }}
                            aria-label="Cancel"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEdit(product.id, note)}
                          className="mt-1.5 inline-flex items-center gap-1 text-xs"
                          style={{ color: 'var(--catalog-ink-muted)' }}
                        >
                          <Pencil className="h-3 w-3" />
                          {note ? note : 'Add a note'}
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => remove.mutate(product.id)}
                      className="h-8 w-8 shrink-0 self-start rounded-full"
                      style={{ color: 'var(--catalog-ink-muted)' }}
                      aria-label="Remove from selection"
                    >
                      <Trash2 className="mx-auto h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>

              {!contactCaptured && !contactPromptDone() && (
                <button
                  type="button"
                  onClick={() => setShowSheet(true)}
                  className="mt-5 w-full rounded-full border px-4 py-3 text-sm font-medium"
                  style={{ borderColor: 'var(--catalog-hairline)', color: 'var(--catalog-primary)' }}
                >
                  Leave my name &amp; number for the shop
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {showSheet && (
        <CustomerContactSheet
          shopSlug={slug}
          reason="selection"
          onClose={() => setShowSheet(false)}
          onSaved={() => setShowSheet(false)}
        />
      )}
    </CatalogThemeProvider>
  );
}
