'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import * as React from 'react';

interface ThemeProviderProps {
  children: React.ReactNode;
  daoSlug: string;
}

export function ThemeProvider({ children, daoSlug }: ThemeProviderProps) {
  return (
    <NextThemesProvider attribute='class' defaultTheme='light' enableSystem>
      <div data-theme={daoSlug} className='min-h-screen'>
        {children}
      </div>
    </NextThemesProvider>
  );
}
