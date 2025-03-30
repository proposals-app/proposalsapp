'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { ReactNode } from 'react';
import { UpdateManifest } from './update-manifest';

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute='class'
      defaultTheme='dark'
      enableSystem={false} // Disable system preference if default is hardcoded
    >
      <div data-theme='arbitrum' className='min-h-screen'>
        <UpdateManifest daoSlug='arbitrum' />
        {children}{' '}
      </div>
    </NextThemesProvider>
  );
}
