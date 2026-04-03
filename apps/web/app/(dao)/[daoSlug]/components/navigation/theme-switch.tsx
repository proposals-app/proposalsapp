'use client';

import SunIcon from '@/public/assets/web/icons/sun.svg';
import MoonIcon from '@/public/assets/web/icons/moon.svg';
import { useAppTheme } from '@/app/components/providers/app-theme-provider';

interface IconProps {
  className?: string;
}

const Sun = ({ className }: IconProps) => <SunIcon className={className} />;
const Moon = ({ className }: IconProps) => <MoonIcon className={className} />;

export function ModeToggle() {
  const { mode, toggleMode } = useAppTheme();
  const isDark = mode === 'dark';

  return (
    <>
      <div
        onClick={toggleMode}
        className={`relative h-[36px] w-[18px] cursor-pointer border-2 p-1 sm:h-[44px] sm:w-[20px] ${
          isDark ? 'border-neutral-300 bg-black' : 'border-neutral-700 bg-white'
        }`}
        role='button'
        tabIndex={0}
        aria-label='Toggle theme'
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleMode();
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
    </>
  );
}
