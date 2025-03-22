'use client';

import posthog from 'posthog-js';
import { PostHogProvider } from 'posthog-js/react';
import { useEffect } from 'react';
import { cookieConsentGiven } from './banner';

export function PHProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      api_host: `${process.env.NEXT_PUBLIC_ROOT_DOMAIN}/ingest`,
      ui_host: 'https://eu.posthog.com',
      capture_pageview: false,
      capture_pageleave: true,
      persistence:
        cookieConsentGiven() === 'yes' ? 'localStorage+cookie' : 'memory',
    });
  }, []);

  return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
}
