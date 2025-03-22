import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { ReactNode } from 'react';
import { UpdateManifest } from './update-manifest';

export async function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider attribute='class' defaultTheme='light' enableSystem>
      <UpdateManifest daoSlug='arbitrum' />
      <div data-theme='arbitrum' className='min-h-screen'>
        {children}
      </div>
    </NextThemesProvider>
  );
}
