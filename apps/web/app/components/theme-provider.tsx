import { cookies } from 'next/headers';
import { ReactNode, Suspense } from 'react';

export default async function SuspendedThemeProvider({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <Suspense>
      <ThemeProvider>{children}</ThemeProvider>
    </Suspense>
  );
}

export async function ThemeProvider({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();

  const themeMode =
    (cookieStore.get('theme-mode')?.value as 'light' | 'dark') ?? 'dark';

  const themeVariant = cookieStore.get('theme-variant')?.value ?? 'arbitrum';

  return (
    <div className={themeMode} data-theme={themeVariant}>
      {children}{' '}
    </div>
  );
}
