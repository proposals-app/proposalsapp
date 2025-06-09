'use client';

import { useEffect } from 'react';

const themeColors = {
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
} as const;

export function ViewportBackground({
  theme,
  mode,
}: {
  theme?: string;
  mode: 'light' | 'dark';
}) {
  useEffect(() => {
    const themeKey = (theme as keyof typeof themeColors) || 'default';
    const color = themeColors[themeKey]?.[mode] || themeColors.default[mode];

    // Set HTML background for overscroll behavior
    document.documentElement.style.backgroundColor = color;

    // Cleanup on unmount
    return () => {
      document.documentElement.style.backgroundColor = '';
    };
  }, [theme, mode]);

  return null;
}
