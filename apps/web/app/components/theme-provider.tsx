import { cookies } from 'next/headers';
import { ReactNode } from 'react';

export async function ThemeProvider({ children }: { children: ReactNode }) {
  const themeMode = (await cookies()).get('theme-mode')?.value ?? 'dark';
  const themeVariant =
    (await cookies()).get('theme-variant')?.value ?? 'arbitrum';

  return (
    <div className={themeMode} data-theme={themeVariant}>
      {children}{' '}
    </div>
  );
}
