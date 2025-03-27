'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import SunIcon from '@/public/assets/web/icons/sun.svg';
import MoonIcon from '@/public/assets/web/icons/moon.svg';

interface IconProps {
  className?: string;
}

const Sun = ({ className }: IconProps) => <SunIcon className={className} />;
const Moon = ({ className }: IconProps) => <MoonIcon className={className} />;

export function ModeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  if (!mounted) {
    return null;
  }

  const isDark = theme === 'dark';

  return (
    <div
      onClick={toggleTheme}
      className='relative h-[36px] w-[18px] cursor-pointer border-2 border-neutral-700 bg-white p-1 sm:h-[44px] sm:w-[20px] dark:border-neutral-300 dark:bg-black'
      role='button'
      tabIndex={0}
      aria-label='Toggle theme'
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
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
              <Moon className='h-[12px] w-[12px] text-neutral-300 dark:text-neutral-700' />
            ) : (
              <Sun className='h-[12px] w-[12px] text-neutral-300 dark:text-neutral-700' />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
