import { cookies } from 'next/headers';
import { Suspense, type ReactNode } from 'react';
import { ViewportBackground } from './viewport-background';

export async function ThemeProvider({
  children,
  theme,
}: {
  children: ReactNode;
  theme?: string;
}) {
  const cookieStore = await cookies();

  const themeMode =
    (cookieStore.get('theme-mode')?.value as 'light' | 'dark') ?? 'dark';

  const themeVariant = cookieStore.get('theme-variant')?.value ?? theme;

  return (
    <div className={themeMode} data-theme={themeVariant}>
      <Suspense>
        <ViewportBackground theme={themeVariant} mode={themeMode} />
      </Suspense>
      {children}
    </div>
  );
}
