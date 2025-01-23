'use client';

import * as Tooltip from '@radix-ui/react-tooltip';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import * as React from 'react';

interface ThemeProviderProps {
  children: React.ReactNode;
  daoSlug: string;
}

export function ThemeProvider({ children, daoSlug }: ThemeProviderProps) {
  return (
    <NextThemesProvider attribute='class' defaultTheme='light' enableSystem>
      <Tooltip.Provider>
        <div data-theme={daoSlug} className='min-h-screen'>
          {children}
        </div>
      </Tooltip.Provider>
    </NextThemesProvider>
  );
}
