'use client';

import { useSafariViewportFix } from '@/app/hooks/useSafariViewportFix';

export function SafariViewportProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useSafariViewportFix();
  return <>{children}</>;
}
