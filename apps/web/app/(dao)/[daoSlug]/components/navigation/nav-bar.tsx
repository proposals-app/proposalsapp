import { cookies } from 'next/headers';
import { NavBarContent } from './nav-bar-content';

export async function NavBar({ daoSlug }: { daoSlug: string }) {
  let theme: 'light' | 'dark' = 'dark';

  const cookieStore = await cookies();
  theme = (cookieStore.get('theme-mode')?.value as 'light' | 'dark') ?? 'dark';

  return <NavBarContent daoSlug={daoSlug} initialTheme={theme} />;
}
