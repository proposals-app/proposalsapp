'use client';

import { useEffect, useState } from 'react';
import { usePostHog } from 'posthog-js/react';

type ConsentStatus = 'yes' | 'no' | 'undecided' | '';

export function cookieConsentGiven(): ConsentStatus {
  if (typeof window === 'undefined') return '';

  if (!localStorage.getItem('cookie_consent')) {
    return 'undecided';
  }
  const consent = localStorage.getItem('cookie_consent');
  return (consent as ConsentStatus) || '';
}

export default function Banner() {
  const [consentGiven, setConsentGiven] = useState<ConsentStatus>('');
  const posthog = usePostHog();

  useEffect(() => {
    // We want this to only run once the client loads
    // or else it causes a hydration error
    setConsentGiven(cookieConsentGiven());
  }, []);

  useEffect(() => {
    if (consentGiven !== '') {
      posthog.set_config({
        persistence: consentGiven === 'yes' ? 'localStorage+cookie' : 'memory',
      });
    }
  }, [consentGiven, posthog]);

  const handleAcceptCookies = (): void => {
    localStorage.setItem('cookie_consent', 'yes');
    setConsentGiven('yes');
  };

  const handleDeclineCookies = (): void => {
    localStorage.setItem('cookie_consent', 'no');
    setConsentGiven('no');
  };

  return (
    <div>
      {consentGiven === 'undecided' && (
        <div className='border-neutral-350 dark:border-neutral-650 fixed right-0 bottom-0 left-0 z-50 border-t bg-neutral-50 sm:right-8 sm:left-8 sm:border-x md:right-16 md:left-16 lg:right-36 lg:left-36 dark:bg-neutral-900'>
          <div className='container mx-auto px-4 py-4 sm:px-6 lg:px-8'>
            <div className='flex flex-col items-center justify-between gap-4 sm:flex-row'>
              <p className='text-center text-sm sm:text-left sm:text-base'>
                We use tracking cookies to understand how you use the product
                and help us improve it. Please accept cookies to help us
                improve.
              </p>
              <div className='flex w-full gap-3 sm:w-auto'>
                <button
                  type='button'
                  onClick={handleAcceptCookies}
                  className='flex-1 bg-neutral-700 px-4 py-2 text-sm font-medium text-neutral-200 transition-colors duration-200 hover:bg-neutral-600 sm:flex-initial dark:bg-neutral-200 dark:text-neutral-700 dark:hover:bg-neutral-100'
                >
                  Accept cookies
                </button>
                <button
                  type='button'
                  onClick={handleDeclineCookies}
                  className='flex-1 bg-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors duration-200 hover:bg-neutral-100 sm:flex-initial dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700'
                >
                  Decline cookies
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
