'use client';

import { useTheme } from 'next-themes';
import Image from 'next/image';
import { useEffect, useState } from 'react';

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

  return (
    <div
      onClick={toggleTheme}
      className='relative h-[36px] w-[18px] cursor-pointer border-2 border-neutral-700 bg-white
        p-1 sm:h-[44px] sm:w-[20px] dark:border-neutral-300 dark:bg-black'
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
          theme === 'dark'
            ? 'top-[calc(100%-14px)] sm:top-[calc(100%-18px)]'
            : 'top-0'
          }`}
      >
        <div
          className='h-[16px] w-[16px] bg-neutral-700 transition-colors sm:h-[20px] sm:w-[20px]
            dark:bg-neutral-300'
        >
          <div className='relative flex h-full w-full items-center justify-center'>
            <Image
              src={
                theme === 'dark'
                  ? `${process.env.NEXT_PUBLIC_ROOT_DOMAIN}/assets/web/moon.svg`
                  : `${process.env.NEXT_PUBLIC_ROOT_DOMAIN}/assets/web/sun.svg`
              }
              alt={theme === 'dark' ? 'Dark mode' : 'Light mode'}
              width={10}
              height={10}
              className='sm:h-[12px] sm:w-[12px]'
            />
          </div>
        </div>
      </div>
    </div>
  );
}
