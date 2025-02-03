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
      className='relative h-[44px] w-[20px] cursor-pointer border-2 border-neutral-700 bg-white
        p-1 dark:border-neutral-300 dark:bg-black'
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
          theme === 'dark' ? 'top-[calc(100%-18px)]' : 'top-0' }`}
      >
        <div className='h-[20px] w-[20px] bg-neutral-700 transition-colors dark:bg-neutral-300'>
          <div className='relative flex h-full w-full items-center justify-center'>
            <Image
              src={
                theme === 'dark'
                  ? '/assets/web/moon.svg'
                  : '/assets/web/sun.svg'
              }
              alt={theme === 'dark' ? 'Dark mode' : 'Light mode'}
              width={12}
              height={12}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
