import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { listThemePresets, updateShopTheme } from '@/services/superAdmin';
import { getApiErrorMessage } from '@/utils/apiError';
import { useToast } from '@/hooks/useToast';
import type { ResolvedTheme, ThemeConfig } from '@/types/theme';

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

interface Props {
  shopId: number;
  shopSlug: string;
  themeConfig: ThemeConfig;
  themeResolved: ResolvedTheme;
  onSaved: () => void;
}

export default function ThemeTab({ shopId, shopSlug, themeConfig, themeResolved, onSaved }: Props) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [preset, setPreset] = useState(themeConfig.preset);
  const [primary, setPrimary] = useState(themeConfig.palette.primary ?? '');
  const [accent, setAccent] = useState(themeConfig.palette.accent ?? '');
  const [tagline, setTagline] = useState(themeConfig.hero.tagline ?? '');
  const [splashOff, setSplashOff] = useState(themeConfig.splash.enabled === false);

  const { data: presets } = useQuery({
    queryKey: ['super-admin', 'theme-presets'],
    queryFn: listThemePresets,
  });

  const activePreset = useMemo(
    () => presets?.find((p) => p.key === preset),
    [presets, preset],
  );

  const config: ThemeConfig = {
    version: 1,
    preset,
    palette: {
      primary: primary && HEX_RE.test(primary) ? primary : null,
      accent: accent && HEX_RE.test(accent) ? accent : null,
    },
    hero: { image_url: themeConfig.hero.image_url ?? null, tagline: tagline || null },
    splash: { enabled: splashOff ? false : null },
  };

  const primaryInvalid = primary !== '' && !HEX_RE.test(primary);
  const accentInvalid = accent !== '' && !HEX_RE.test(accent);

  const mutation = useMutation({
    mutationFn: () => updateShopTheme(shopId, config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'shops', shopId] });
      onSaved();
    },
    onError: (err) => showToast('error', getApiErrorMessage(err, 'Could not save the theme.')),
  });

  const dirty =
    preset !== themeConfig.preset ||
    (primary || '') !== (themeConfig.palette.primary ?? '') ||
    (accent || '') !== (themeConfig.palette.accent ?? '') ||
    (tagline || '') !== (themeConfig.hero.tagline ?? '') ||
    splashOff !== (themeConfig.splash.enabled === false);

  const swatchPrimary = primary && HEX_RE.test(primary) ? primary : activePreset?.primary ?? themeResolved.brand['600'];
  const swatchAccent = accent && HEX_RE.test(accent) ? accent : activePreset?.accent ?? themeResolved.accent;
  const swatchBg = activePreset?.surface_bg ?? themeResolved.surface_bg;

  function selectPreset(key: string) {
    setPreset(key);
    setPrimary('');
    setAccent('');
    setTagline('');
    setSplashOff(false);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-6">
        <section className="rounded-xl border border-neutral-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-neutral-900">Preset</h2>
          <p className="mt-1 text-xs text-neutral-400">
            Picking a preset resets any colour or tagline overrides.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {presets?.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => selectPreset(p.key)}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  preset === p.key
                    ? 'border-brand-500 ring-1 ring-brand-500'
                    : 'border-neutral-200 hover:border-neutral-300'
                }`}
              >
                <div className="flex gap-1.5">
                  <span className="h-6 w-6 rounded-full" style={{ background: p.primary }} />
                  <span className="h-6 w-6 rounded-full" style={{ background: p.accent }} />
                  <span
                    className="h-6 w-6 rounded-full border border-neutral-200"
                    style={{ background: p.surface_bg }}
                  />
                </div>
                <p className="mt-2 text-xs font-medium text-neutral-900">{p.label}</p>
                <p className="mt-0.5 text-[11px] leading-tight text-neutral-400">{p.description}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-neutral-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-neutral-900">Overrides</h2>
          <p className="mt-1 text-xs text-neutral-400">
            Optional. Leave blank to use the preset&rsquo;s own colours.
          </p>
          <div className="mt-4 space-y-4">
            <ColorField
              label="Primary colour"
              value={primary}
              onChange={setPrimary}
              invalid={primaryInvalid}
              placeholder={activePreset?.primary}
            />
            <ColorField
              label="Accent colour"
              value={accent}
              onChange={setAccent}
              invalid={accentInvalid}
              placeholder={activePreset?.accent}
            />
            <label className="block text-sm">
              <span className="text-neutral-600">Hero tagline</span>
              <input
                type="text"
                value={tagline}
                maxLength={80}
                onChange={(e) => setTagline(e.target.value)}
                placeholder={themeResolved.hero_tagline}
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={splashOff}
                onChange={(e) => setSplashOff(e.target.checked)}
              />
              Skip the welcome splash screen
            </label>
          </div>
        </section>

        <button
          type="button"
          disabled={!dirty || primaryInvalid || accentInvalid || mutation.isPending}
          onClick={() => mutation.mutate()}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {mutation.isPending ? 'Saving…' : 'Save theme'}
        </button>
      </div>

      <div className="space-y-3">
        <div className="overflow-hidden rounded-xl border border-neutral-200">
          <div className="px-4 py-6 text-center" style={{ background: swatchBg }}>
            <div
              className="mx-auto flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold text-white"
              style={{
                background: `radial-gradient(circle at 35% 35%, ${swatchAccent}, color-mix(in srgb, ${swatchAccent} 55%, #000))`,
              }}
            >
              SK
            </div>
            <p
              className="mt-2 text-sm font-semibold"
              style={{ color: swatchPrimary, fontFamily: `"${activePreset?.heading_font ?? themeResolved.heading_font}", serif` }}
            >
              Your Shop
            </p>
            <button
              type="button"
              className="mt-3 rounded-full px-4 py-1.5 text-xs font-semibold text-white"
              style={{ background: swatchPrimary }}
              disabled
            >
              Explore
            </button>
          </div>
        </div>
        <p className="text-xs text-neutral-400">Swatch preview. Save, then open the storefront for the full look.</p>
        <a
          href={`/shop/${shopSlug}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          <ExternalLink className="h-4 w-4" />
          Open storefront
        </a>
      </div>
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
  invalid,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  invalid: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="text-neutral-600">{label}</span>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : placeholder ?? '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-10 shrink-0 cursor-pointer rounded border border-neutral-300 bg-white"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? '#rrggbb'}
          className={`w-full rounded-lg border px-3 py-2 text-sm ${
            invalid ? 'border-red-400' : 'border-neutral-300'
          }`}
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="shrink-0 text-xs text-neutral-400 hover:text-neutral-600"
          >
            clear
          </button>
        )}
      </div>
      {invalid && <span className="mt-1 block text-xs text-red-500">Enter a hex colour like #8B1A1A.</span>}
    </label>
  );
}
