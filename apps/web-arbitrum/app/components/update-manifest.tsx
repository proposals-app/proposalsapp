'use client';

import { updateManifest } from '@/lib/update_manifest';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export const UpdateManifest = ({ daoSlug }: { daoSlug: string }) => {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme } = useTheme();

  // Handle initial mount
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    if (resolvedTheme) {
      const isDark = resolvedTheme === 'dark';

      const timeoutId = setTimeout(() => {
        updateManifest(isDark);
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [mounted, daoSlug, resolvedTheme]);

  return null;
};
