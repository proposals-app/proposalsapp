import { cookies } from 'next/headers';
import { type ReactNode } from 'react';
import { ViewportBackground } from './viewport-background';

export default async function SuspendedThemeProvider({
  children,
  theme,
}: {
  children: ReactNode;
  theme?: string;
}) {
  return <ThemeProvider defaultTheme={theme}>{children}</ThemeProvider>;
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
      <ViewportBackground theme={themeVariant} mode={themeMode} />
      {children}
    </div>
  );
}
