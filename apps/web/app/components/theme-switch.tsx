'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import SunIcon from '@/public/assets/web/icons/sun.svg';
import MoonIcon from '@/public/assets/web/icons/moon.svg';
import { UpdateManifest } from './update-manifest';

interface IconProps {
  className?: string;
}

const Sun = ({ className }: IconProps) => <SunIcon className={className} />;
const Moon = ({ className }: IconProps) => <MoonIcon className={className} />;

interface ModeToggleProps {
  initialTheme: 'light' | 'dark'; // Prop to receive theme from server
}

export function ModeToggle({ initialTheme }: ModeToggleProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [currentMode, setCurrentMode] = useState<'light' | 'dark'>(
    initialTheme
  );

  // Ensure client-side state matches the cookie if it exists on hydration
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const cookieTheme = document.cookie
        .split('; ')
        .find((row) => row.startsWith('theme-mode='))
        ?.split('=')[1];
      if (cookieTheme && (cookieTheme === 'light' || cookieTheme === 'dark')) {
        setCurrentMode(cookieTheme);
      }
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const newMode: 'light' | 'dark' = currentMode === 'dark' ? 'light' : 'dark';

    // Optimistically update the button appearance
    setCurrentMode(newMode);

    // Set the cookie directly on the client
    const domainParts = window.location.hostname.split('.');
    const domain =
      domainParts.length > 1
        ? `.${domainParts.slice(-2).join('.')}`
        : window.location.hostname; // Use base domain for subdomains
    const expires = new Date(Date.now() + 31536000000).toUTCString(); // 1 year expiration
    document.cookie = `theme-mode=${newMode}; path=/; expires=${expires}; SameSite=Lax${
      domain !== 'localhost' ? `; domain=${domain}` : ''
    }`;

    // Start transition for the refresh
    startTransition(() => {
      router.refresh(); // Trigger server refresh
    });
  }, [currentMode, router, startTransition]);

  const isDark = currentMode === 'dark';
  const themeForManifest = currentMode;

  return (
    <>
      <div
        onClick={toggleTheme}
        className={`relative h-[36px] w-[18px] cursor-pointer border-2 p-1 sm:h-[44px] sm:w-[20px] ${
          isDark ? 'border-neutral-300 bg-black' : 'border-neutral-700 bg-white'
        } ${isPending ? 'cursor-wait opacity-50' : ''}`}
        role='button'
        tabIndex={isPending ? -1 : 0}
        aria-label='Toggle theme'
        aria-busy={isPending}
        onKeyDown={(e) => {
          if (!isPending && (e.key === 'Enter' || e.key === ' ')) {
            toggleTheme();
          }
        }}
      >
        <div
          className={`absolute left-1/2 -translate-x-1/2 transition-all duration-300 ease-in-out ${
            isDark ? 'top-[calc(100%-14px)] sm:top-[calc(100%-18px)]' : 'top-0'
          }`}
        >
          <div
            className={`h-[16px] w-[16px] ${isDark ? 'bg-neutral-300' : 'bg-neutral-700'} sm:h-[20px] sm:w-[20px]`}
          >
            <div className='relative flex h-full w-full items-center justify-center'>
              {isDark ? (
                <Moon className='h-[12px] w-[12px] fill-neutral-700' />
              ) : (
                <Sun className='h-[12px] w-[12px] fill-neutral-300' />
              )}
            </div>
          </div>
        </div>
      </div>
      <UpdateManifest themeMode={themeForManifest} />
    </>
  );
}
