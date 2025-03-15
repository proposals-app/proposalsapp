'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import * as React from 'react';
import { useState, useEffect } from 'react';

// ===== MAIN THEME PROVIDER =====
interface ThemeProviderProps {
  children: React.ReactNode;
  daoSlug: string;
}

export function ThemeProvider({ children, daoSlug }: ThemeProviderProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div />;

  return (
    <NextThemesProvider attribute='class' defaultTheme='light' enableSystem>
      <div data-theme={daoSlug} className='min-h-screen'>
        {children}
      </div>
    </NextThemesProvider>
  );
}
