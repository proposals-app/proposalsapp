import type { MetadataRoute } from 'next';
import {
  DEFAULT_THEME_MODE,
  DEFAULT_THEME_VARIANT,
  getThemeColor,
} from '@/lib/theme';

export default function manifest(): MetadataRoute.Manifest {
  const defaultThemeColor = getThemeColor(
    DEFAULT_THEME_VARIANT,
    DEFAULT_THEME_MODE
  );

  return {
    name: 'proposals.app',
    short_name: 'proposals.app',
    description:
      'The place where you can find all the info from your favorite DAOs.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: defaultThemeColor,
    theme_color: defaultThemeColor,
    icons: [
      {
        src: '/assets/logo_192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/assets/logo_256.png',
        sizes: '256x256',
        type: 'image/png',
      },
      {
        src: '/assets/logo_512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/assets/logo_512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
