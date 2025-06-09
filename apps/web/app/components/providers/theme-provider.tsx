import { cookies } from 'next/headers';
import { Suspense, type ReactNode } from 'react';

export default async function SuspendedThemeProvider({
  children,
  theme,
}: {
  children: ReactNode;
  theme?: string;
}) {
  return (
    <Suspense>
      <ThemeProvider defaultTheme={theme}>{children}</ThemeProvider>
    </Suspense>
  );
}

export async function ThemeProvider({
  children,
  defaultTheme,
}: {
  children: ReactNode;
  defaultTheme?: string;
}) {
  const cookieStore = await cookies();

  const themeMode =
    (cookieStore.get('theme-mode')?.value as 'light' | 'dark') ?? 'dark';

  const themeVariant = cookieStore.get('theme-variant')?.value ?? defaultTheme;

  return (
    <div className={themeMode} data-theme={themeVariant}>
      {children}
    </div>
  );
}
