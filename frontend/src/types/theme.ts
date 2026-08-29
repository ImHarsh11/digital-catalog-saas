export interface ResolvedTheme {
  preset: string;
  brand: Record<string, string>; // "50".."900" -> hex
  accent: string;
  accent_contrast: string;
  surface_bg: string;
  surface_card: string;
  ink: string;
  ink_muted: string;
  splash_enabled: boolean;
  splash_style: 'ornate' | 'minimal' | 'none';
  hero_style: 'ornate' | 'minimal' | 'photo';
  hero_image_url: string | null;
  hero_tagline: string;
  heading_font: string;
  body_font: string;
  card_radius: string;
}

export interface ThemeConfig {
  version: number;
  preset: string;
  palette: { primary?: string | null; accent?: string | null };
  hero: { image_url?: string | null; tagline?: string | null };
  splash: { enabled?: boolean | null };
}

export interface ThemePresetInfo {
  key: string;
  label: string;
  description: string;
  primary: string;
  accent: string;
  surface_bg: string;
  heading_font: string;
}
