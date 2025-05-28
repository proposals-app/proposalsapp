'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { usePostHog } from 'posthog-js/react';
import { useSession } from '@/lib/auth/auth-client';

export function PostHogIdentifier() {
  const posthog = usePostHog();
  const { data } = useSession();

  useEffect(() => {
    if (data && data.user && !posthog._isIdentified()) {
      posthog.identify(data.user.id, { email: data.user.email });
    }
  }, [data, posthog]);

  return null;
}

export function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const posthog = usePostHog();

  useEffect(() => {
    if (typeof window !== 'undefined' && posthog && pathname) {
      let url = window.origin + pathname;
      if (searchParams.toString()) {
        url = url + `?${searchParams.toString()}`;
      }
      posthog.capture('$pageview', { $current_url: url });
    }
  }, [pathname, searchParams, posthog]);

  return null;
}
