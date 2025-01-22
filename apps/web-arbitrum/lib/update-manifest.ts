import manifest from '../public/manifest.json';

export const updateManifest = (isDark: boolean) => {
  const neutral50 = '#fafafa';
  const neutral950 = '#0a0a0a';

  const updatedManifest = {
    ...manifest,
    theme_color: isDark ? neutral950 : neutral50,
    background_color: isDark ? neutral950 : neutral50,
  };

  const manifestString = JSON.stringify(updatedManifest);
  const blob = new Blob([manifestString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const linkElement = document.querySelector('link[rel="manifest"]');
  if (linkElement) {
    // Store the old URL to revoke it
    const oldUrl = linkElement.getAttribute('href');
    // Set new URL
    linkElement.setAttribute('href', url);
    // Revoke old URL if it was a blob
    if (oldUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(oldUrl);
    }
  }
};
