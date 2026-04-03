import { WEB_MANIFEST_PATH } from '@/lib/pwa';
import { getThemeColor, type ThemeMode, type ThemeVariant } from '@/lib/theme';

export const updateManifest = async (
  variant: ThemeVariant,
  mode: ThemeMode
) => {
  try {
    const response = await fetch(WEB_MANIFEST_PATH, { cache: 'no-store' });
    if (!response.ok) {
      return;
    }

    const manifest = await response.json();
    const themeColor = getThemeColor(variant, mode);

    const updatedManifest = {
      ...manifest,
      theme_color: themeColor,
      background_color: themeColor,
    };

    const manifestString = JSON.stringify(updatedManifest);
    const blob = new Blob([manifestString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const linkElement = document.querySelector('link[rel="manifest"]');
    if (!linkElement) {
      return;
    }

    const oldUrl = linkElement.getAttribute('href');
    linkElement.setAttribute('href', url);
    if (oldUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(oldUrl);
    }
  } catch {
    // A missing manifest should not break page hydration.
  }
};
