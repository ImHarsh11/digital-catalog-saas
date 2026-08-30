import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { ChevronLeft, ChevronRight, Heart, Phone, Search, SlidersHorizontal } from 'lucide-react';
import {
  getShopCatalog,
  listShopProducts,
  toggleProductLike,
  type SortOption,
} from '@/services/publicCatalog';
import { effectivePrice, formatPrice } from '@/utils/currency';
import ProductImage from '@/components/catalog/ProductImage';
import Spinner from '@/components/Spinner';
import CatalogThemeProvider from '@/components/catalog/CatalogThemeProvider';
import SelectionButton from '@/components/catalog/SelectionButton';
import SelectionBar from '@/components/catalog/SelectionBar';
import CustomerContactSheet, { contactPromptDone } from '@/components/catalog/CustomerContactSheet';
import PromoCarousel from '@/components/catalog/PromoCarousel';
import CatalogUnavailablePage from './CatalogUnavailablePage';
import type { PublicCategory, PublicProductListItem, PublicPromo } from '@/types/publicCatalog';

// ─── Constants ────────────────────────────────────────────────────────────────

const GRID_TEXTURE =
  'repeating-linear-gradient(0deg,transparent,transparent 8px,rgba(255,255,255,0.025) 8px,rgba(255,255,255,0.025) 9px),' +
  'repeating-linear-gradient(90deg,transparent,transparent 8px,rgba(255,255,255,0.025) 8px,rgba(255,255,255,0.025) 9px)';

const HERO_SLIDES = [
  {
    tag: 'EXCLUSIVE COLLECTION',
    h0: 'Timeless Weaves.',
    h1: 'Eternal Elegance.',
    sub: 'Exquisite Silks. Crafted for Generations.',
    bg: 'linear-gradient(145deg,#1E0E28,#3A1848,#5A2868)',
  },
  {
    tag: 'BRIDAL COLLECTION',
    h0: 'Bridal Silks',
    h1: '2025',
    sub: 'Handcrafted heritage for your most special day.',
    bg: 'linear-gradient(145deg,#200808,#401010,#5A1414)',
  },
  {
    tag: 'NEW ARRIVALS',
    h0: 'New Season',
    h1: 'Arrivals',
    sub: 'Celebrate festive moments in the finest silk.',
    bg: 'linear-gradient(145deg,#081A0A,#103A14,#184A1C)',
  },
];

const CAT_GRADIENTS = [
  'linear-gradient(145deg,#6B1515,#A83030)',
  'linear-gradient(145deg,#3A1055,#6A2090)',
  'linear-gradient(145deg,#1A5030,#2A8050)',
  'linear-gradient(145deg,#7A5A18,#B08030)',
  'linear-gradient(145deg,#1A2A6A,#2A4AB0)',
  'linear-gradient(145deg,#C47080,#903050)',
];

const PRODUCT_GRADS = [
  'linear-gradient(145deg,#2A1040,#4A1E60)',
  'linear-gradient(145deg,#401010,#6B2020)',
  'linear-gradient(145deg,#0A2A10,#1A4A20)',
  'linear-gradient(145deg,#2A2010,#4A3820)',
  'linear-gradient(145deg,#102040,#1A3060)',
  'linear-gradient(145deg,#400820,#6B1038)',
];

// ─── Utility helpers ──────────────────────────────────────────────────────────

function shopInitials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
}

function discountedPrice(price: number, discountPercent: number | null): number | null {
  if (!discountPercent || discountPercent <= 0) return null;
  return effectivePrice(price, discountPercent);
}

// ─── Welcome / Splash screen ──────────────────────────────────────────────────

function WelcomeSplash({
  shopName,
  tagline,
  coverImage,
  onEnter,
}: {
  shopName: string;
  tagline: string;
  coverImage: string | null;
  onEnter: () => void;
}) {
  const initials = shopInitials(shopName);
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden">
      {coverImage ? (
        <>
          <img src={coverImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.88), rgba(0,0,0,0.55) 50%, rgba(0,0,0,0.35))' }} />
        </>
      ) : (
        <div className="absolute inset-0" style={{ background: 'var(--catalog-splash-grad)' }} />
      )}
      <div className="relative flex flex-col items-center px-8 text-center">
        <div
          className="mb-7 flex h-24 w-24 items-center justify-center rounded-full shadow-2xl"
          style={{
            background: 'radial-gradient(circle at 35% 35%, var(--catalog-accent), color-mix(in srgb, var(--catalog-accent) 50%, #000))',
            boxShadow: '0 0 0 3px rgba(255,255,255,0.15), 0 20px 40px rgba(0,0,0,0.4)',
          }}
        >
          <span className="text-3xl font-bold tracking-widest text-white">{initials}</span>
        </div>
        <h1
          className="text-3xl font-bold uppercase tracking-[0.12em] text-white drop-shadow-lg sm:text-4xl"
          style={{ fontFamily: 'var(--catalog-heading-font)', textWrap: 'balance' } as CSSProperties}
        >
          {shopName}
        </h1>
        <p className="mt-3 text-sm font-light uppercase tracking-[0.2em] text-white/60">{tagline}</p>
        <div className="my-8 flex items-center gap-3">
          <div className="h-px w-12" style={{ background: 'var(--catalog-accent)' }} />
          <div className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--catalog-accent)' }} />
          <div className="h-px w-12" style={{ background: 'var(--catalog-accent)' }} />
        </div>
        <button
          type="button"
          onClick={onEnter}
          className="rounded-full px-10 py-3.5 text-sm font-semibold uppercase tracking-[0.18em] text-white transition-all active:scale-95"
          style={{ background: 'var(--catalog-primary)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}
        >
          Enter Store
        </button>
      </div>
    </div>
  );
}

// ─── Hero Carousel ────────────────────────────────────────────────────────────

function HeroCarousel({
  images,
  tagline,
  shopName,
  onShopNow,
}: {
  images: string[];
  tagline: string;
  shopName: string;
  onShopNow: () => void;
}) {
  const [active, setActive] = useState(0);
  const hasImages = images.length > 0;
  const count = hasImages ? images.length : HERO_SLIDES.length;

  useEffect(() => {
    if (count <= 1) return;
    const id = setInterval(() => setActive((i) => (i + 1) % count), 5000);
    return () => clearInterval(id);
  }, [count]);

  const slide = hasImages ? null : HERO_SLIDES[active];
  const slideBg = hasImages
    ? 'linear-gradient(145deg,#1E0E28,#3A1848)'
    : slide!.bg;

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Slide background */}
      <div
        style={{
          height: 240,
          position: 'relative',
          background: slideBg,
          transition: 'background 0.7s ease',
          overflow: 'hidden',
        }}
      >
        {/* Grid texture */}
        <div style={{ position: 'absolute', inset: 0, background: GRID_TEXTURE }} />

        {/* Real images */}
        {hasImages &&
          images.map((img, i) => (
            <div
              key={img}
              style={{
                position: 'absolute', inset: 0,
                opacity: i === active ? 1 : 0,
                transition: 'opacity 0.7s ease',
              }}
            >
              <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading={i === 0 ? 'eager' : 'lazy'} />
            </div>
          ))}

        {/* Gradient overlay for image slides */}
        {hasImages && (
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.2) 60%, transparent 100%)' }} />
        )}

        {/* Decorative circles top-right */}
        <div style={{ position: 'absolute', top: -20, right: -20, width: 120, height: 120, border: '1px solid rgba(201,160,74,0.18)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', top: 10, right: 10, width: 60, height: 60, border: '1px solid rgba(201,160,74,0.12)', borderRadius: '50%' }} />

        {/* Slide content */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '24px 24px 20px' }}>
          {/* Eyebrow tag */}
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--catalog-accent)', letterSpacing: '2.5px', textTransform: 'uppercase', marginBottom: 6 }}>
            {slide ? slide.tag : 'CURATED COLLECTION'}
          </div>
          {/* Headline */}
          <div
            style={{
              fontFamily: 'var(--catalog-heading-font)',
              fontSize: 26,
              fontWeight: 700,
              color: '#fff',
              lineHeight: 1.2,
              marginBottom: 8,
              textShadow: '0 2px 12px rgba(0,0,0,0.4)',
            }}
          >
            {slide ? (
              <>
                <div>{slide.h0}</div>
                <div>{slide.h1}</div>
              </>
            ) : (
              tagline
            )}
          </div>
          {/* Subtitle */}
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: 14 }}>
            {slide ? slide.sub : `Explore ${shopName}'s curated collection`}
          </div>
          {/* CTA button */}
          <button
            type="button"
            onClick={onShopNow}
            style={{
              alignSelf: 'flex-start',
              background: 'var(--catalog-accent)',
              color: '#1E0E28',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
              padding: '8px 18px',
              borderRadius: 3,
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 2px 10px rgba(201,160,74,0.35)',
            }}
          >
            Shop Now
          </button>
        </div>
      </div>

      {/* Dots strip */}
      <div
        style={{
          background: 'var(--catalog-primary)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 6,
          padding: '8px 0 10px',
        }}
      >
        {Array.from({ length: count }).map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setActive(i)}
            aria-label={`Slide ${i + 1}`}
            style={{
              width: i === active ? 20 : 6,
              height: 6,
              borderRadius: 3,
              border: 'none',
              cursor: 'pointer',
              background: i === active ? 'var(--catalog-accent)' : 'rgba(255,255,255,0.25)',
              transition: 'all 0.3s ease',
              padding: 0,
            }}
          />
        ))}
      </div>

      {/* Desktop arrows */}
      {count > 1 && (
        <>
          <button
            type="button"
            onClick={() => setActive((i) => (i - 1 + count) % count)}
            aria-label="Previous slide"
            className="absolute left-3 top-24 hidden -translate-y-1/2 items-center justify-center rounded-full bg-black/25 p-2.5 text-white backdrop-blur-sm transition-all hover:bg-black/45 sm:flex"
            style={{ top: 110 }}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setActive((i) => (i + 1) % count)}
            aria-label="Next slide"
            className="absolute right-3 hidden -translate-y-1/2 items-center justify-center rounded-full bg-black/25 p-2.5 text-white backdrop-blur-sm transition-all hover:bg-black/45 sm:flex"
            style={{ top: 110 }}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}
    </div>
  );
}

// ─── Trust badge strip ────────────────────────────────────────────────────────

const TRUST_BADGES = [
  {
    label: 'Pure Handloom Silks',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
      </svg>
    ),
  },
  {
    label: 'Traditional Craft',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    label: 'Free Shipping ₹2000+',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="1" y="3" width="15" height="13" rx="1" />
        <path d="M16 8h4l3 3v5h-7V8zM5.5 21a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM18.5 21a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" />
      </svg>
    ),
  },
  {
    label: 'Secure Payments',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="1" y="4" width="22" height="16" rx="2" />
        <path d="M1 10h22" />
      </svg>
    ),
  },
];

function TrustStrip() {
  return (
    <div
      style={{
        background: '#fff',
        borderBottom: '1px solid rgba(201,160,74,0.12)',
        display: 'flex',
      }}
    >
      {TRUST_BADGES.map((badge, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '10px 4px',
            gap: 5,
            borderRight: i < TRUST_BADGES.length - 1 ? '1px solid rgba(201,160,74,0.12)' : 'none',
          }}
        >
          <div style={{ color: 'var(--catalog-accent)' }}>{badge.icon}</div>
          <div
            style={{
              fontSize: 8.5,
              fontWeight: 700,
              color: '#3D2A18',
              textAlign: 'center',
              lineHeight: 1.3,
              letterSpacing: '0.3px',
            }}
          >
            {badge.label}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Category portrait cards (horizontal scroll) ──────────────────────────────

function CategoryCards({
  categories,
  activeId,
  onSelect,
}: {
  categories: PublicCategory[];
  activeId: number | '';
  onSelect: (id: number | '') => void;
}) {
  if (categories.length === 0) return null;
  return (
    <div style={{ background: 'var(--catalog-bg)', padding: '20px 0 4px' }}>
      {/* Section heading */}
      <div style={{ padding: '0 20px 16px' }}>
        <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--catalog-ink-muted)', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: 4 }}>
          Explore
        </div>
        <div style={{ fontFamily: 'var(--catalog-heading-font)', fontSize: 21, fontWeight: 700, color: 'var(--catalog-ink)', lineHeight: 1.2 }}>
          Shop by Collection
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--catalog-accent)' }} />
          <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, var(--catalog-accent), transparent)', opacity: 0.4 }} />
        </div>
      </div>

      {/* Horizontal scroll */}
      <div style={{ overflowX: 'auto', paddingBottom: 4 }} className="scrollbar-hide">
        <div style={{ display: 'flex', gap: 14, padding: '0 20px', minWidth: 'max-content' }}>
          {/* "All" card */}
          <button
            type="button"
            onClick={() => onSelect('')}
            style={{
              width: 100,
              height: 140,
              borderRadius: 12,
              overflow: 'hidden',
              flexShrink: 0,
              cursor: 'pointer',
              border: 'none',
              padding: 0,
              position: 'relative',
              background: activeId === '' ? 'var(--catalog-primary)' : 'var(--catalog-ink)',
              boxShadow: activeId === '' ? '0 0 0 2.5px var(--catalog-accent), 0 4px 18px rgba(0,0,0,0.2)' : '0 4px 18px rgba(0,0,0,0.15)',
            }}
          >
            <div style={{ position: 'absolute', inset: 0, background: GRID_TEXTURE }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.55) 100%)' }} />
            <div style={{ position: 'absolute', top: 8, right: 8, width: 20, height: 20, border: '1px solid rgba(201,160,74,0.35)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 5, height: 5, background: 'var(--catalog-accent)', borderRadius: '50%', opacity: 0.7 }} />
            </div>
            <div style={{ position: 'absolute', bottom: 12, left: 10, right: 10 }}>
              <div style={{ fontFamily: 'var(--catalog-heading-font)', fontSize: 13, fontWeight: 700, color: '#fff' }}>All</div>
              <div style={{ fontSize: 9, color: 'rgba(201,160,74,0.85)', marginTop: 2 }}>Browse →</div>
            </div>
          </button>

          {categories.map((cat, i) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelect(activeId === cat.id ? '' : cat.id)}
              style={{
                width: 130,
                height: 168,
                borderRadius: 12,
                overflow: 'hidden',
                flexShrink: 0,
                cursor: 'pointer',
                border: 'none',
                padding: 0,
                position: 'relative',
                background: cat.cover_image_url ? undefined : CAT_GRADIENTS[i % CAT_GRADIENTS.length],
                boxShadow: activeId === cat.id
                  ? '0 0 0 2.5px var(--catalog-accent), 0 4px 18px rgba(0,0,0,0.2)'
                  : '0 4px 18px rgba(0,0,0,0.15)',
              }}
            >
              {cat.cover_image_url && (
                <img src={cat.cover_image_url} alt={cat.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
              )}
              <div style={{ position: 'absolute', inset: 0, background: GRID_TEXTURE }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.7) 100%)' }} />
              <div style={{ position: 'absolute', top: 10, right: 10, width: 22, height: 22, border: '1px solid rgba(201,160,74,0.35)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 5, height: 5, background: 'var(--catalog-accent)', borderRadius: '50%', opacity: 0.7 }} />
              </div>
              <div style={{ position: 'absolute', bottom: 14, left: 12, right: 12 }}>
                <div style={{ fontFamily: 'var(--catalog-heading-font)', fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 2 }}>{cat.name}</div>
                <div style={{ fontSize: 9, color: 'rgba(201,160,74,0.85)' }}>Browse →</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Gold divider ─────────────────────────────────────────────────────────────

function GoldDivider() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px 0' }}>
      <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, transparent, rgba(201,160,74,0.4))' }} />
      <div style={{ display: 'flex', gap: 5 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--catalog-accent)', opacity: 0.7 - i * 0.15 }} />
        ))}
      </div>
      <div style={{ flex: 1, height: 1, background: 'linear-gradient(to left, transparent, rgba(201,160,74,0.4))' }} />
    </div>
  );
}

// ─── Gold filter chips (category filter) ──────────────────────────────────────

function FilterChips({
  categories,
  activeId,
  onSelect,
}: {
  categories: PublicCategory[];
  activeId: number | '';
  onSelect: (id: number | '') => void;
}) {
  if (categories.length === 0) return null;
  return (
    <div style={{ background: '#fff', padding: '10px 0', overflowX: 'auto' }} className="scrollbar-hide">
      <div style={{ display: 'flex', gap: 8, padding: '0 16px', minWidth: 'max-content' }}>
        <button
          type="button"
          onClick={() => onSelect('')}
          style={{
            padding: '7px 14px',
            borderRadius: 50,
            fontSize: 11,
            fontWeight: activeId === '' ? 600 : 400,
            cursor: 'pointer',
            border: activeId === '' ? '1.5px solid var(--catalog-accent)' : '1px solid rgba(201,160,74,0.18)',
            background: activeId === '' ? 'rgba(201,160,74,0.12)' : 'rgba(201,160,74,0.04)',
            color: activeId === '' ? 'var(--catalog-accent)' : 'rgba(90,58,32,0.8)',
            transition: 'all 0.2s',
          }}
        >
          All
        </button>
        {categories.map((cat) => {
          const isActive = activeId === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelect(isActive ? '' : cat.id)}
              style={{
                padding: '7px 14px',
                borderRadius: 50,
                fontSize: 11,
                fontWeight: isActive ? 600 : 400,
                cursor: 'pointer',
                border: isActive ? '1.5px solid var(--catalog-accent)' : '1px solid rgba(201,160,74,0.18)',
                background: isActive ? 'rgba(201,160,74,0.12)' : 'rgba(201,160,74,0.04)',
                color: isActive ? 'var(--catalog-accent)' : 'rgba(90,58,32,0.8)',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              {cat.cover_image_url && (
                <img src={cat.cover_image_url} alt="" style={{ width: 14, height: 14, borderRadius: '50%', objectFit: 'cover' }} />
              )}
              {cat.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Section heading ──────────────────────────────────────────────────────────

function SectionHeading({ eyebrow, title }: { eyebrow?: string; title: string }) {
  return (
    <div style={{ padding: '20px 16px 0' }}>
      {eyebrow && (
        <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--catalog-ink-muted)', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: 4 }}>
          {eyebrow}
        </div>
      )}
      <div style={{ fontFamily: 'var(--catalog-heading-font)', fontSize: 21, fontWeight: 700, color: 'var(--catalog-ink)', lineHeight: 1.2 }}>
        {title}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--catalog-accent)' }} />
        <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, var(--catalog-accent), transparent)', opacity: 0.4 }} />
      </div>
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === 'AVAILABLE') return null;
  const label = status === 'SOLD' ? 'Sold Out' : 'Out of Stock';
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
      <span className="rounded-full bg-black/75 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-white">
        {label}
      </span>
    </div>
  );
}

// ─── Product card (Takshi design) ─────────────────────────────────────────────

function ProductCard({
  product,
  index,
  slug,
  onLike,
  liked,
  onProductClick,
}: {
  product: PublicProductListItem;
  index: number;
  slug: string;
  onLike?: (productId: number) => void;
  liked?: boolean;
  onProductClick?: () => void;
}) {
  const unavailable = product.status !== 'AVAILABLE';
  const final = discountedPrice(product.price, product.discount_percent);
  const gradBg = PRODUCT_GRADS[index % PRODUCT_GRADS.length];

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 12,
        boxShadow: '0 2px 14px rgba(0,0,0,0.08)',
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Image area */}
      <Link to={`/shop/${slug}/product/${product.id}`} onClick={onProductClick} style={{ display: 'block', textDecoration: 'none' }}>
        <div
          style={{
            height: 162,
            background: product.primary_image_url ? undefined : gradBg,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {!product.primary_image_url && (
            <div style={{ position: 'absolute', inset: 0, background: GRID_TEXTURE }} />
          )}
          <ProductImage
            src={product.primary_image_url}
            alt={product.name}
            className={`h-full w-full object-cover transition-transform duration-500 hover:scale-105 ${unavailable ? 'opacity-65 grayscale-[25%]' : ''}`}
          />
          <StatusBadge status={product.status} />

          {/* Discount badge (top-left, gold) */}
          {product.discount_percent ? (
            <div
              style={{
                position: 'absolute',
                top: 8,
                left: 8,
                background: 'var(--catalog-accent)',
                color: '#1E0E28',
                fontSize: 8,
                fontWeight: 700,
                padding: '3px 7px',
                borderRadius: 3,
              }}
            >
              -{Math.round(product.discount_percent)}%
            </div>
          ) : null}

          {/* Heart button (top-right, dark circle) */}
          {onLike && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onLike(product.id);
              }}
              style={{
                position: 'absolute',
                top: 7,
                right: 7,
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: liked ? 'rgba(180,30,30,0.85)' : 'rgba(30,14,40,0.65)',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <Heart
                style={{
                  width: 13,
                  height: 13,
                  fill: liked ? '#fff' : 'none',
                  stroke: '#fff',
                  strokeWidth: 2,
                }}
              />
            </button>
          )}
        </div>
      </Link>

      {/* Footer */}
      <div style={{ padding: '10px 10px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Link to={`/shop/${slug}/product/${product.id}`} onClick={onProductClick} style={{ textDecoration: 'none' }}>
          <div
            style={{
              fontSize: 11.5,
              fontWeight: 600,
              color: 'var(--catalog-ink)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {product.name}
          </div>
          <div style={{ fontSize: 9.5, color: 'var(--catalog-ink-muted)', marginTop: 1 }}>
            {product.category.name}
          </div>
        </Link>

        {/* Price row */}
        <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
          <div>
            {final !== null && product.discount_percent ? (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--catalog-ink)' }}>{formatPrice(final)}</span>
                <span style={{ fontSize: 10, textDecoration: 'line-through', color: '#B0A090' }}>{formatPrice(product.price)}</span>
              </div>
            ) : (
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--catalog-ink)' }}>{formatPrice(product.price)}</span>
            )}
          </div>
          {product.status === 'AVAILABLE' && <SelectionButton slug={slug} productId={product.id} />}
        </div>

        {product.quantity_available <= 3 && product.quantity_available > 0 && product.status === 'AVAILABLE' && (
          <div style={{ fontSize: 10, fontWeight: 600, color: '#C07828', marginTop: 2 }}>
            Only {product.quantity_available} left!
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Bottom tab bar (Takshi dark bar) ─────────────────────────────────────────

type NavTab = 'home' | 'collections' | 'search' | 'call';

function BottomTabBar({
  activeTab,
  onTabChange,
  shopPhone,
}: {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  shopPhone: string | null;
}) {
  const tabs: Array<{ id: NavTab; label: string; icon: ReactNode }> = [
    {
      id: 'home',
      label: 'Home',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      ),
    },
    {
      id: 'collections',
      label: 'Collections',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      ),
    },
    {
      id: 'search',
      label: 'Search',
      icon: <Search style={{ width: 22, height: 22 }} />,
    },
    {
      id: 'call',
      label: shopPhone ? 'Call' : 'Contact',
      icon: <Phone style={{ width: 22, height: 22 }} />,
    },
  ];

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 sm:hidden"
      style={{
        background: 'var(--catalog-primary)',
        borderTop: '1px solid rgba(201,160,74,0.14)',
        display: 'flex',
        height: 72,
        paddingTop: 8,
      }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: isActive ? 'var(--catalog-accent)' : '#9A8070',
              padding: '2px 0',
            }}
          >
            <div style={{ opacity: isActive ? 1 : 0.75 }}>{tab.icon}</div>
            <span style={{ fontSize: 10, fontWeight: isActive ? 600 : 400 }}>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Sort / filter bar ────────────────────────────────────────────────────────

const SORT_OPTIONS: Array<{ value: SortOption; label: string }> = [
  { value: 'newest', label: 'Newest first' },
  { value: 'price_asc', label: 'Price: Low → High' },
  { value: 'price_desc', label: 'Price: High → Low' },
];

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ShopCatalogPage() {
  const { shopSlug } = useParams<{ shopSlug: string }>();
  const slug = shopSlug ?? '';
  const location = useLocation();
  const skipSplash = (location.state as { skipSplash?: boolean } | null)?.skipSplash === true;

  const [showSplash, setShowSplash] = useState(!skipSplash);
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [sort, setSort] = useState<SortOption>('newest');
  const [page, setPage] = useState(1);
  const [activePromo, setActivePromo] = useState<PublicPromo | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);

  const [showFilters, setShowFilters] = useState(false);
  const [colorFilter, setColorFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');

  const [showContactPopup, setShowContactPopup] = useState(false);
  const [contactDismissed, setContactDismissed] = useState(() => contactPromptDone());
  const productViewCount = useRef(0);
  const [likedProducts, setLikedProducts] = useState<Set<number>>(() => new Set());

  const handleLike = useCallback(
    (productId: number) => {
      toggleProductLike(slug, productId).then((result) => {
        setLikedProducts((prev) => {
          const next = new Set(prev);
          if (result.liked) next.add(productId);
          else next.delete(productId);
          return next;
        });
      });
    },
    [slug],
  );

  useEffect(() => {
    if (!contactDismissed && productViewCount.current >= 5 && !showContactPopup) {
      setShowContactPopup(true);
    }
  }, [contactDismissed, showContactPopup]);

  useEffect(() => { setPage(1); }, [search, categoryId, sort, colorFilter, brandFilter, priceMin, priceMax, activePromo]);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (activeTab === 'search') {
      setTimeout(() => searchRef.current?.focus(), 100);
    }
  }, [activeTab]);

  const handleTabChange = (tab: NavTab) => {
    setActiveTab(tab);
    if (tab === 'home') {
      setCategoryId('');
      setActivePromo(null);
      setSearch('');
      setSearchInput('');
      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (tab === 'collections') {
      setTimeout(() => gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    } else if (tab === 'search') {
      setTimeout(() => { searchRef.current?.focus(); gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60);
    } else if (tab === 'call') {
      setShowContactPopup(true);
    }
  };

  const { data: catalog, isLoading: shopLoading, isError: shopIsError, error: shopError } = useQuery({
    queryKey: ['public', 'shop', slug],
    queryFn: () => getShopCatalog(slug),
    enabled: Boolean(slug),
    retry: false,
  });

  const shopUnavailable = shopIsError && shopError instanceof AxiosError && shopError.response?.status === 403;
  const PAGE_SIZE = 20;
  const promoDiscounted = activePromo?.kind === 'on_sale';
  const promoNewDays = activePromo?.kind === 'new_arrivals' ? 21 : undefined;
  const effectiveSort: SortOption = activePromo?.kind === 'new_collection' ? 'newest' : sort;

  const { data: productPage, isLoading: productsLoading, isError: productsIsError, refetch: refetchProducts } = useQuery({
    queryKey: ['public', 'products', slug, { categoryId, search, sort: effectiveSort, page, colorFilter, brandFilter, priceMin, priceMax, promo: activePromo?.key ?? null }],
    queryFn: () =>
      listShopProducts(slug, {
        categoryId: categoryId || undefined,
        search: search || undefined,
        sort: effectiveSort,
        page,
        pageSize: PAGE_SIZE,
        color: colorFilter || undefined,
        brand: brandFilter || undefined,
        priceMin: priceMin ? Number(priceMin) : undefined,
        priceMax: priceMax ? Number(priceMax) : undefined,
        discounted: promoDiscounted || undefined,
        newWithinDays: promoNewDays,
      }),
    enabled: Boolean(slug) && Boolean(catalog),
  });

  const selectPromo = useCallback((promo: PublicPromo | null) => {
    setActivePromo(promo);
    if (promo) {
      setCategoryId('');
      setSearchInput('');
      setSearch('');
      setTimeout(() => gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    }
  }, []);

  if (shopLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: 'var(--catalog-splash-grad, linear-gradient(135deg,#691f2d,#932436))' }}>
        <Spinner />
      </div>
    );
  }

  if (shopUnavailable) {
    return <CatalogUnavailablePage title="This catalog is currently unavailable." message="Please check back later, or contact the shop directly." />;
  }

  if (shopIsError || !catalog) {
    return <CatalogUnavailablePage title="We couldn't find this catalog." message="Double check the link or QR code and try again." />;
  }

  const products = productPage?.items ?? [];
  const suggestions = productPage?.suggestions ?? null;
  const total = productPage?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasFilters = Boolean(search || categoryId || colorFilter || brandFilter || priceMin || priceMax || activePromo);
  const activeFilterCount = [colorFilter, brandFilter, priceMin, priceMax].filter(Boolean).length;
  const priceRangeInverted = priceMin !== '' && priceMax !== '' && Number(priceMin) > Number(priceMax);
  const { shop, categories, theme, promos, hero_images } = catalog;
  const activeCategoryName = categories.find((c) => c.id === categoryId)?.name;

  const handleCategorySelect = (id: number | '') => {
    setCategoryId(id);
    setActivePromo(null);
    if (id !== '') {
      setTimeout(() => gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    }
  };

  return (
    <CatalogThemeProvider theme={theme}>
      {showSplash && theme.splash_enabled && (
        <WelcomeSplash
          shopName={shop.name}
          tagline={theme.hero_tagline}
          coverImage={hero_images[0] ?? null}
          onEnter={() => setShowSplash(false)}
        />
      )}

      <div ref={topRef} className="min-h-screen pb-20 sm:pb-8" style={{ background: 'var(--catalog-bg)' }}>

        {/* ── Header ── */}
        <header
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 30,
            background: 'var(--catalog-primary)',
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Hamburger / Logo */}
          <div style={{ width: 36, display: 'flex', flexDirection: 'column', gap: 4, cursor: 'pointer' }}>
            {shop.logo_url ? (
              <img src={shop.logo_url} alt={shop.name} style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover' }} />
            ) : (
              <>
                <div style={{ height: 2, background: 'var(--catalog-accent)', width: 20 }} />
                <div style={{ height: 2, background: 'var(--catalog-accent)', width: 13 }} />
              </>
            )}
          </div>

          {/* Centered brand name */}
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div
              style={{
                fontFamily: 'var(--catalog-heading-font)',
                fontSize: 20,
                fontWeight: 700,
                color: 'var(--catalog-accent)',
                letterSpacing: '0.02em',
                lineHeight: 1.1,
              }}
            >
              {shop.name}
            </div>
            {shop.city && (
              <div style={{ fontSize: 7.5, color: 'rgba(201,160,74,0.55)', letterSpacing: '2px', textTransform: 'uppercase', marginTop: 1 }}>
                {shop.city}
              </div>
            )}
          </div>

          {/* Search icon */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('search');
              setTimeout(() => { searchRef.current?.focus(); gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100);
            }}
            style={{ width: 36, display: 'flex', justifyContent: 'flex-end', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--catalog-accent)' }}
            aria-label="Search"
          >
            <Search style={{ width: 20, height: 20 }} />
          </button>
        </header>

        {/* ── Hero carousel ── */}
        <HeroCarousel
          images={hero_images}
          tagline={theme.hero_tagline}
          shopName={shop.name}
          onShopNow={() => gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        />

        {/* ── Trust badges ── */}
        <TrustStrip />

        {/* ── Promo banners ── */}
        {promos.length > 0 && (
          <div style={{ padding: '16px 16px 0' }}>
            <PromoCarousel promos={promos} activeKey={activePromo?.key ?? null} onSelect={selectPromo} />
          </div>
        )}

        {/* ── Shop by collection ── */}
        {categories.length > 0 && (
          <CategoryCards categories={categories} activeId={categoryId} onSelect={handleCategorySelect} />
        )}

        {/* ── Gold divider ── */}
        <GoldDivider />

        {/* ── Products section ── */}
        <section>
          <SectionHeading
            eyebrow={activeCategoryName ? 'Category' : (activePromo ? undefined : 'Handpicked For You')}
            title={activeCategoryName ?? (activePromo ? activePromo.title : 'Featured Products')}
          />

          {/* ── Filter chips ── */}
          {categories.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <FilterChips categories={categories} activeId={categoryId} onSelect={handleCategorySelect} />
            </div>
          )}

          {/* ── Sticky search + filter bar ── */}
          <div
            ref={gridRef}
            className="sticky top-14 z-20"
            style={{
              background: 'var(--catalog-bg)',
              backdropFilter: 'blur(12px)',
              borderBottom: '1px solid var(--catalog-hairline)',
              padding: '10px 16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Search input */}
              <div style={{ position: 'relative', flex: 1 }}>
                <Search
                  style={{
                    position: 'absolute',
                    left: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: 15,
                    height: 15,
                    color: 'var(--catalog-ink-muted)',
                    pointerEvents: 'none',
                  }}
                />
                <input
                  ref={searchRef}
                  type="search"
                  inputMode="search"
                  value={searchInput}
                  onChange={(e) => { setSearchInput(e.target.value); setActiveTab('search'); }}
                  onFocus={() => setActiveTab('search')}
                  placeholder="Search products…"
                  style={{
                    width: '100%',
                    borderRadius: 50,
                    border: '1px solid var(--catalog-hairline)',
                    background: 'var(--catalog-card)',
                    color: 'var(--catalog-ink)',
                    padding: '8px 16px 8px 36px',
                    fontSize: 13,
                    outline: 'none',
                  }}
                />
              </div>

              {/* Filter button */}
              <button
                type="button"
                onClick={() => setShowFilters((v) => !v)}
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  borderRadius: 50,
                  border: showFilters ? '1px solid var(--catalog-primary)' : '1px solid var(--catalog-hairline)',
                  padding: '8px 12px',
                  fontSize: 12,
                  fontWeight: 500,
                  background: showFilters ? 'color-mix(in srgb, var(--catalog-primary) 8%, transparent)' : 'var(--catalog-card)',
                  color: 'var(--catalog-primary)',
                  cursor: 'pointer',
                }}
              >
                <SlidersHorizontal style={{ width: 14, height: 14 }} />
                <span className="hidden sm:inline">Filters</span>
                {activeFilterCount > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: -4,
                      right: -4,
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      background: 'var(--catalog-primary)',
                      color: '#fff',
                      fontSize: 10,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {/* Sort (desktop) */}
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortOption)}
                className="hidden sm:block"
                style={{
                  borderRadius: 50,
                  border: '1px solid var(--catalog-hairline)',
                  padding: '8px 12px',
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--catalog-ink)',
                  background: 'var(--catalog-card)',
                  outline: 'none',
                }}
                aria-label="Sort products"
              >
                {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {/* Filter panel */}
            {showFilters && (
              <div
                style={{
                  marginTop: 10,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 12,
                  borderRadius: 12,
                  border: '1px solid var(--catalog-hairline)',
                  background: 'var(--catalog-card)',
                  padding: 12,
                  alignItems: 'flex-end',
                }}
              >
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--catalog-ink-muted)' }}>Color</span>
                  <input
                    type="text"
                    value={colorFilter}
                    onChange={(e) => setColorFilter(e.target.value)}
                    placeholder="e.g. Red"
                    style={{ width: 100, borderRadius: 8, border: '1px solid var(--catalog-hairline)', padding: '6px 10px', fontSize: 12, color: 'var(--catalog-ink)', outline: 'none' }}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--catalog-ink-muted)' }}>Brand</span>
                  <input
                    type="text"
                    value={brandFilter}
                    onChange={(e) => setBrandFilter(e.target.value)}
                    placeholder="e.g. Kanjivaram"
                    style={{ width: 120, borderRadius: 8, border: '1px solid var(--catalog-hairline)', padding: '6px 10px', fontSize: 12, color: 'var(--catalog-ink)', outline: 'none' }}
                  />
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--catalog-ink-muted)' }}>Price (₹)</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input type="number" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} placeholder="Min" style={{ width: 70, borderRadius: 8, border: '1px solid var(--catalog-hairline)', padding: '6px 10px', fontSize: 12, color: 'var(--catalog-ink)', outline: 'none' }} />
                    <span style={{ fontSize: 12, color: 'var(--catalog-ink-muted)' }}>—</span>
                    <input type="number" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} placeholder="Max" style={{ width: 70, borderRadius: 8, border: '1px solid var(--catalog-hairline)', padding: '6px 10px', fontSize: 12, color: 'var(--catalog-ink)', outline: 'none' }} />
                  </div>
                  {priceRangeInverted && <p style={{ fontSize: 10, color: '#e53e3e' }}>Min must be less than Max</p>}
                </div>
                <label className="flex-col gap-1 sm:hidden" style={{ display: 'flex' }}>
                  <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--catalog-ink-muted)' }}>Sort</span>
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as SortOption)}
                    style={{ borderRadius: 8, border: '1px solid var(--catalog-hairline)', padding: '6px 10px', fontSize: 12, color: 'var(--catalog-ink)', outline: 'none' }}
                  >
                    {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </label>
                {(colorFilter || brandFilter || priceMin || priceMax) && (
                  <button
                    type="button"
                    onClick={() => { setColorFilter(''); setBrandFilter(''); setPriceMin(''); setPriceMax(''); }}
                    style={{ borderRadius: 8, border: '1px solid var(--catalog-primary)', padding: '6px 12px', fontSize: 12, fontWeight: 500, color: 'var(--catalog-primary)', background: 'transparent', cursor: 'pointer', alignSelf: 'flex-end' }}
                  >
                    Clear all
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Active filter pills */}
          {hasFilters && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '10px 16px 0' }}>
              {search && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, borderRadius: 50, border: '1px solid var(--catalog-hairline)', padding: '4px 10px', fontSize: 11, color: 'var(--catalog-ink-muted)' }}>
                  "{search}"
                  <button type="button" onClick={() => { setSearchInput(''); setSearch(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.6, padding: 0, fontSize: 14 }}>×</button>
                </span>
              )}
              {activePromo && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, borderRadius: 50, padding: '4px 10px', fontSize: 11, fontWeight: 500, color: '#fff', background: 'var(--catalog-primary)' }}>
                  {activePromo.title}
                  <button type="button" onClick={() => selectPromo(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.8, padding: 0, fontSize: 14 }}>×</button>
                </span>
              )}
              <span style={{ fontSize: 11, color: 'var(--catalog-ink-muted)', alignSelf: 'center' }}>
                {total} {total === 1 ? 'result' : 'results'}
              </span>
            </div>
          )}

          {/* ── Product grid ── */}
          <div style={{ padding: '14px 14px 24px' }}>
            {productsLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
                <Spinner />
              </div>
            ) : productsIsError ? (
              <div style={{ padding: '48px 0', textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: 'var(--catalog-ink-muted)' }}>
                  Couldn't load products.{' '}
                  <button type="button" onClick={() => refetchProducts()} style={{ fontWeight: 600, textDecoration: 'underline', color: 'var(--catalog-primary)', background: 'none', border: 'none', cursor: 'pointer' }}>
                    Retry
                  </button>
                </p>
              </div>
            ) : products.length === 0 ? (
              <div style={{ padding: '60px 0', textAlign: 'center' }}>
                {hasFilters ? (
                  <>
                    <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--catalog-ink)' }}>No results</p>
                    <p style={{ fontSize: 13, color: 'var(--catalog-ink-muted)', marginTop: 4 }}>Try adjusting your search or filters</p>
                    {suggestions && suggestions.length > 0 && (
                      <div style={{ marginTop: 24 }}>
                        <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--catalog-ink)', marginBottom: 14 }}>You might also like</p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                          {suggestions.map((p, i) => (
                            <ProductCard key={p.id} product={p} index={i} slug={slug} onLike={handleLike} liked={likedProducts.has(p.id)} onProductClick={() => { productViewCount.current += 1; }} />
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <p style={{ fontSize: 13, color: 'var(--catalog-ink-muted)' }}>No products yet. Check back soon!</p>
                )}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }} className="sm:grid-cols-3 lg:grid-cols-4">
                {products.map((product, i) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    index={i}
                    slug={slug}
                    onLike={handleLike}
                    liked={likedProducts.has(product.id)}
                    onProductClick={() => { productViewCount.current += 1; }}
                  />
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--catalog-hairline)', background: 'var(--catalog-card)', color: 'var(--catalog-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: page === 1 ? 0.4 : 1 }}
                  aria-label="Previous page"
                >
                  <ChevronLeft style={{ width: 16, height: 16 }} />
                </button>
                <span style={{ fontSize: 13, color: 'var(--catalog-ink-muted)' }}>{page} / {totalPages}</span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--catalog-hairline)', background: 'var(--catalog-card)', color: 'var(--catalog-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: page === totalPages ? 0.4 : 1 }}
                  aria-label="Next page"
                >
                  <ChevronRight style={{ width: 16, height: 16 }} />
                </button>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Desktop phone link */}
      {shop.phone && (
        <a
          href={`tel:${shop.phone}`}
          className="fixed bottom-6 right-6 z-40 hidden items-center gap-2 rounded-full px-4 py-2.5 text-xs font-medium text-white shadow-lg transition-all hover:scale-105 sm:flex"
          style={{ background: 'var(--catalog-primary)', border: '1px solid rgba(255,255,255,0.12)' }}
        >
          <Phone style={{ width: 14, height: 14 }} />
          {shop.phone}
        </a>
      )}

      <SelectionBar slug={slug} />

      {showContactPopup && (
        <CustomerContactSheet
          shopSlug={slug}
          onClose={() => { setShowContactPopup(false); setContactDismissed(true); }}
          onSaved={() => { setShowContactPopup(false); setContactDismissed(true); }}
        />
      )}

      <BottomTabBar activeTab={activeTab} onTabChange={handleTabChange} shopPhone={shop.phone} />
    </CatalogThemeProvider>
  );
}
