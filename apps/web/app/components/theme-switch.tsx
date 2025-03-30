'use client';

import { useEffect, useState, useCallback, useTransition } from 'react'; // Added useTransition
import { useRouter } from 'next/navigation'; // Import useRouter
import SunIcon from '@/public/assets/web/icons/sun.svg';
import MoonIcon from '@/public/assets/web/icons/moon.svg';
import { UpdateManifest } from './update-manifest';

// Helper to get cookie value on the client
function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return undefined;
}

// Helper to set cookie on the client
function setCookie(name: string, value: string, days: number = 365) {
  if (typeof document === 'undefined') return;
  let expires = '';
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    expires = `; expires=${date.toUTCString()}`;
  }
  const domainParts = window.location.hostname.split('.');
  const domain =
    domainParts.length > 1
      ? `.${domainParts.slice(-2).join('.')}`
      : window.location.hostname;
  document.cookie = `${name}=${value || ''}${expires}; path=/; domain=${domain}; SameSite=Lax`;
}

interface IconProps {
  className?: string;
}

const Sun = ({ className }: IconProps) => <SunIcon className={className} />;
const Moon = ({ className }: IconProps) => <MoonIcon className={className} />;

export function ModeToggle() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // Initialize state based on the server-rendered class
  const [currentMode, setCurrentMode] = useState<'light' | 'dark'>(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('dark')
        ? 'dark'
        : 'light';
    }
    return 'dark'; // Default server-side guess or before hydration
  });
  const [mounted, setMounted] = useState(false);

  // Synchronize state with actual class after mount
  useEffect(() => {
    const actualMode = document.documentElement.classList.contains('dark')
      ? 'dark'
      : 'light';
    setCurrentMode(actualMode);
    setMounted(true);
  }, []);

  const toggleTheme = useCallback(() => {
    const newMode = currentMode === 'dark' ? 'light' : 'dark';

    // Optimistically update the button's appearance
    setCurrentMode(newMode);

    // Set the cookie
    setCookie('theme-mode', newMode);

    // Start transition for the refresh
    startTransition(() => {
      router.refresh(); // Trigger server refresh
    });
  }, [currentMode, router]);

  const isDark = currentMode === 'dark';
  const themeForManifest = mounted ? currentMode : 'dark';

  if (!mounted) {
    // Render placeholder based on initial dark guess
    return (
      <div className='relative h-[36px] w-[18px] cursor-pointer border-2 border-neutral-300 bg-black p-1 sm:h-[44px] sm:w-[20px]' />
    );
  }

  return (
    <>
      <div
        onClick={toggleTheme}
        className={`relative h-[36px] w-[18px] cursor-pointer border-2 p-1 sm:h-[44px] sm:w-[20px] ${
          isDark ? 'border-neutral-300 bg-black' : 'border-neutral-700 bg-white'
        } ${isPending ? 'cursor-wait opacity-50' : ''}`} // Add pending state style
        role='button'
        tabIndex={isPending ? -1 : 0} // Disable interaction during refresh
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
      {/* UpdateManifest remains, it will run after the refresh */}
      <UpdateManifest themeMode={themeForManifest} />
    </>
  );
}
