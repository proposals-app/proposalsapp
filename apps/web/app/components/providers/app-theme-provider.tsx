'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { updateManifest } from '@/lib/update_manifest';
import {
  DEFAULT_THEME_MODE,
  DEFAULT_THEME_VARIANT,
  getThemeColor,
  getThemeVariantFromLocation,
  normalizeThemeMode,
  THEME_MODE_COOKIE,
  type ThemeMode,
  type ThemeVariant,
} from '@/lib/theme';

type AppThemeContextValue = {
  mode: ThemeMode;
  variant: ThemeVariant;
  setMode: (nextMode: ThemeMode) => void;
  toggleMode: () => void;
};

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

function getInitialThemeMode(): ThemeMode {
  if (typeof document === 'undefined') {
    return DEFAULT_THEME_MODE;
  }

  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

function getInitialThemeVariant(): ThemeVariant {
  if (typeof window === 'undefined') {
    return DEFAULT_THEME_VARIANT;
  }

  return getThemeVariantFromLocation(
    window.location.pathname,
    window.location.hostname
  );
}

function setThemeColorMeta(color: string) {
  if (typeof document === 'undefined') {
    return;
  }

  let meta = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"][data-active-theme="true"]'
  );

  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.dataset.activeTheme = 'true';
    document.head.appendChild(meta);
  }

  meta.content = color;
}

function applyThemeToDocument(mode: ThemeMode, variant: ThemeVariant) {
  if (typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;
  const color = getThemeColor(variant, mode);

  root.classList.toggle('dark', mode === 'dark');
  root.setAttribute('data-theme', variant);
  root.style.backgroundColor = color;
  root.style.colorScheme = mode;
  setThemeColorMeta(color);
}

function persistThemeMode(mode: ThemeMode) {
  if (typeof window === 'undefined') {
    return;
  }

  const hostname = window.location.hostname.toLowerCase();
  const configuredRootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN
    ?.replace(/^(https?:\/\/)?/, '')
    .replace(/\/$/, '')
    .toLowerCase();
  const domainParts = hostname.split('.');
  const domain =
    hostname === 'localhost' || hostname.endsWith('.localhost')
      ? undefined
      : configuredRootDomain
        ? `.${configuredRootDomain}`
        : domainParts.length > 1
          ? `.${domainParts.slice(-2).join('.')}`
          : undefined;
  const expires = new Date(Date.now() + 31536000000).toUTCString();

  document.cookie = `${THEME_MODE_COOKIE}=${mode}; path=/; expires=${expires}; SameSite=Lax${
    domain ? `; domain=${domain}` : ''
  }`;
}

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(getInitialThemeMode);
  const [variant] = useState<ThemeVariant>(getInitialThemeVariant);

  useEffect(() => {
    applyThemeToDocument(mode, variant);
    void updateManifest(variant, mode);
  }, [mode, variant]);

  const setMode = (nextMode: ThemeMode) => {
    const normalizedMode = normalizeThemeMode(nextMode);
    persistThemeMode(normalizedMode);
    applyThemeToDocument(normalizedMode, variant);
    setModeState(normalizedMode);
  };

  const toggleMode = () => {
    setMode(mode === 'dark' ? 'light' : 'dark');
  };

  return (
    <AppThemeContext.Provider value={{ mode, variant, setMode, toggleMode }}>
      {children}
    </AppThemeContext.Provider>
  );
}

export function useAppTheme() {
  const context = useContext(AppThemeContext);

  if (!context) {
    throw new Error('useAppTheme must be used within an AppThemeProvider');
  }

  return context;
}
