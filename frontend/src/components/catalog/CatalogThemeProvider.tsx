import { useEffect, type CSSProperties, type ReactNode } from 'react';
import type { ResolvedTheme } from '@/types/theme';

/** Matches the backend `royal-maroon` preset. Used before a shop's real
 *  theme has loaded (e.g. a direct link to a product page). */
const FALLBACK_THEME: ResolvedTheme = {
  preset: 'royal-maroon',
  brand: {
    '50': '#fbeef0',
    '100': '#f6d7dc',
    '200': '#eab0ba',
    '300': '#dd8592',
    '400': '#cf5e70',
    '500': '#c04156',
    '600': '#b12f42',
    '700': '#932436',
    '800': '#79202e',
    '900': '#5f1c27',
  },
  accent: '#c9a84c',
  accent_contrast: '#1a1a1a',
  surface_bg: '#fbf6f4',
  surface_card: '#ffffff',
  ink: '#2a1a1d',
  ink_muted: '#8a7377',
  splash_enabled: true,
  splash_style: 'ornate',
  hero_style: 'ornate',
  hero_image_url: null,
  hero_tagline: 'Crafted with elegance',
  heading_font: 'Playfair Display',
  body_font: 'Inter',
  card_radius: '1rem',
};

/** Real-world fallback stacks for every font a preset may name. */
const FONT_FALLBACK: Record<string, string> = {
  Inter: 'system-ui, -apple-system, sans-serif',
  Poppins: 'system-ui, -apple-system, sans-serif',
  'Nunito Sans': 'system-ui, -apple-system, sans-serif',
  'Playfair Display': 'Georgia, "Times New Roman", serif',
  Fraunces: 'Georgia, "Times New Roman", serif',
  'Cormorant Garamond': 'Georgia, "Times New Roman", serif',
  'DM Serif Display': 'Georgia, "Times New Roman", serif',
};

function stack(font: string): string {
  return `"${font}", ${FONT_FALLBACK[font] ?? 'system-ui, sans-serif'}`;
}

function googleFontsHref(theme: ResolvedTheme): string {
  const families = [...new Set([theme.heading_font, theme.body_font])];
  const parts = families.map(
    (f) => `family=${f.replace(/ /g, '+')}:ital,wght@0,400;0,500;0,600;0,700;1,400`,
  );
  return `https://fonts.googleapis.com/css2?${parts.join('&')}&display=swap`;
}

/** CSS custom properties fed to the catalog wrapper. Tailwind v4 `brand-*`
 *  utilities resolve to `--color-brand-*`, so overriding those here re-themes
 *  every `bg-brand-600` / `text-brand-700` inside the subtree for free. */
function themeVars(theme: ResolvedTheme): CSSProperties {
  const brandVars = Object.fromEntries(
    Object.entries(theme.brand).map(([k, v]) => [`--color-brand-${k}`, v]),
  );
  return {
    ...brandVars,
    // The pre-Phase-2 catalog used Tailwind `yellow-*` utilities for every
    // gold accent. Re-point those at the theme accent, scoped to the catalog
    // subtree, so the whole treatment re-themes without touching each class.
    // (Phase 4 replaces the class names outright.)
    '--color-yellow-200': theme.accent,
    '--color-yellow-300': theme.accent,
    '--color-yellow-400': theme.accent,
    '--color-yellow-500': theme.accent,
    '--catalog-primary': theme.brand['600'],
    '--catalog-primary-dark': theme.brand['900'],
    '--catalog-header-grad': `linear-gradient(135deg, ${theme.brand['900']} 0%, ${theme.brand['700']} 55%, ${theme.brand['800']} 100%)`,
    '--catalog-splash-grad': `linear-gradient(135deg, ${theme.brand['900']} 0%, ${theme.brand['700']} 45%, ${theme.brand['800']} 100%)`,
    '--catalog-accent': theme.accent,
    '--catalog-accent-contrast': theme.accent_contrast,
    '--catalog-accent-soft': `color-mix(in srgb, ${theme.accent} 16%, transparent)`,
    '--catalog-hairline': `color-mix(in srgb, ${theme.brand['600']} 12%, transparent)`,
    '--catalog-nav-bg': `color-mix(in srgb, ${theme.brand['900']} 94%, #000)`,
    '--catalog-bg': theme.surface_bg,
    '--catalog-card': theme.surface_card,
    '--catalog-ink': theme.ink,
    '--catalog-ink-muted': theme.ink_muted,
    '--catalog-card-radius': theme.card_radius,
    '--catalog-heading-font': stack(theme.heading_font),
    '--catalog-body-font': stack(theme.body_font),
    background: theme.surface_bg,
    color: theme.ink,
    fontFamily: stack(theme.body_font),
  } as CSSProperties;
}

export default function CatalogThemeProvider({
  theme,
  children,
}: {
  theme: ResolvedTheme | null | undefined;
  children: ReactNode;
}) {
  const resolved = theme ?? FALLBACK_THEME;
  useEffect(() => {
    const href = googleFontsHref(resolved);
    let link = document.head.querySelector<HTMLLinkElement>('link[data-catalog-fonts]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'stylesheet';
      link.setAttribute('data-catalog-fonts', 'true');
      document.head.appendChild(link);
    }
    if (link.href !== href) link.href = href;
  }, [resolved]);

  return (
    <div data-catalog-root className="min-h-screen" style={themeVars(resolved)}>
      {children}
    </div>
  );
}
