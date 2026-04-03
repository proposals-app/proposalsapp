'use client';

import { useSafariViewportFix } from '@/app/hooks/useSafariViewportFix';

export function SafariViewportProvider() {
  useSafariViewportFix();
  return null;
}
