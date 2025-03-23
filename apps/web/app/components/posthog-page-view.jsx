'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, Suspense } from 'react';
import { usePostHog } from 'posthog-js/react';
import { authClient } from '@/lib/auth-client';

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const posthog = usePostHog();
  const { data: session } = authClient.useSession();

  useEffect(() => {
    if (session.user && posthog) {
      posthog.identify(session.user.id, { email: session.user.email });
    }
  }, [session, posthog]);

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

export default function SuspendedPostHogPageView() {
  return (
    <Suspense>
      <PostHogPageView />
    </Suspense>
  );
}
