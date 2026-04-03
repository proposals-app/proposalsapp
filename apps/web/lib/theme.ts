export const THEME_MODE_COOKIE = 'theme-mode';

export const THEME_VARIANTS = ['default', 'arbitrum', 'uniswap'] as const;
export const THEME_MODES = ['light', 'dark'] as const;

export type ThemeVariant = (typeof THEME_VARIANTS)[number];
export type ThemeMode = (typeof THEME_MODES)[number];

export const DEFAULT_THEME_MODE: ThemeMode = 'dark';
export const DEFAULT_THEME_VARIANT: ThemeVariant = 'default';

export const THEME_SURFACE_COLORS: Record<
  ThemeVariant,
  Record<ThemeMode, string>
> = {
  default: {
    light: '#f9fafb',
    dark: '#111827',
  },
  arbitrum: {
    light: '#f9fafb',
    dark: '#14181a',
  },
  uniswap: {
    light: '#fbf9f9',
    dark: '#1a1415',
  },
};

export const THEME_BRAND_ACCENTS: Record<ThemeVariant, string> = {
  default: '#6366f1',
  arbitrum: '#12aaff',
  uniswap: '#ff0522',
};

export function isThemeMode(value: string | null | undefined): value is ThemeMode {
  return value === 'light' || value === 'dark';
}

export function isThemeVariant(
  value: string | null | undefined
): value is ThemeVariant {
  return (
    value === 'default' || value === 'arbitrum' || value === 'uniswap'
  );
}

export function normalizeThemeMode(
  value: string | null | undefined
): ThemeMode {
  return isThemeMode(value) ? value : DEFAULT_THEME_MODE;
}

export function normalizeThemeVariant(
  value: string | null | undefined
): ThemeVariant {
  return isThemeVariant(value) ? value : DEFAULT_THEME_VARIANT;
}

export function getThemeColor(variant: ThemeVariant, mode: ThemeMode): string {
  return THEME_SURFACE_COLORS[variant][mode];
}

export function getThemeAccent(variant: ThemeVariant): string {
  return THEME_BRAND_ACCENTS[variant];
}

export function getThemeColorEntries(variant: ThemeVariant) {
  return [
    {
      media: '(prefers-color-scheme: light)',
      color: getThemeColor(variant, 'light'),
    },
    {
      media: '(prefers-color-scheme: dark)',
      color: getThemeColor(variant, 'dark'),
    },
  ];
}

export function getThemeVariantFromLocation(
  pathname: string,
  hostname: string
): ThemeVariant {
  const pathSegment = pathname.split('/')[1];
  if (isThemeVariant(pathSegment) && pathSegment !== DEFAULT_THEME_VARIANT) {
    return pathSegment;
  }

  const hostSegment = hostname.toLowerCase().split('.')[0];
  if (isThemeVariant(hostSegment) && hostSegment !== DEFAULT_THEME_VARIANT) {
    return hostSegment;
  }

  return DEFAULT_THEME_VARIANT;
}
