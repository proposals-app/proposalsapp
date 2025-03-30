'use client';

import { updateManifest } from '@/lib/update_manifest';
import { useEffect } from 'react';
import { useParams } from 'next/navigation'; // Use useParams for daoSlug

// Renamed prop for clarity
export const UpdateManifest = ({
  themeMode,
}: {
  themeMode: 'light' | 'dark';
}) => {
  const params = useParams();
  const daoSlug = params?.daoSlug as string; // Get daoSlug from route params

  useEffect(() => {
    // No need for 'mounted' state here as themeMode is passed as a prop
    const isDark = themeMode === 'dark';

    // Update manifest whenever themeMode changes
    // Add a small delay to ensure DOM is ready if needed, though likely not necessary here
    const timeoutId = setTimeout(() => {
      updateManifest(isDark);
    }, 50); // Reduced delay

    return () => clearTimeout(timeoutId);
  }, [daoSlug, themeMode]); // Rerun when daoSlug or themeMode changes

  return null; // This component doesn't render anything itself
};
