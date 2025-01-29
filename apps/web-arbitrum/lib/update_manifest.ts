export const updateManifest = async (isDark: boolean) => {
  const neutral50 = '#fafafa';
  const neutral950 = '#0a0a0a';

  // Fetch the manifest file from the correct URL in production
  const manifestUrl = '/manifest.json';
  const response = await fetch(manifestUrl);
  const manifest = await response.json();

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
