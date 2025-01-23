'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@radix-ui/react-dropdown-menu';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

export function ModeToggle() {
  const { setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className='border-neutral-350 inline-flex items-center justify-center rounded-md border
            bg-white p-2 transition-colors hover:bg-neutral-100 focus:outline-hidden
            dark:border-neutral-800 dark:bg-neutral-950 dark:hover:bg-neutral-800'
          aria-label='Toggle theme'
        >
          <Sun
            className='h-[1.2rem] w-[1.2rem] scale-100 rotate-0 text-neutral-600 transition-all
              duration-500 dark:scale-0 dark:-rotate-90 dark:text-neutral-200'
          />
          <Moon
            className='absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 text-neutral-600 transition-all
              duration-500 dark:scale-100 dark:rotate-0 dark:text-neutral-200'
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align='end'
        className='border-neutral-350 min-w-[120px] rounded-md border bg-white shadow-lg
          dark:border-neutral-800 dark:bg-neutral-950'
      >
        <DropdownMenuItem
          className='cursor-pointer px-4 py-2 text-sm text-neutral-600 transition-colors
            hover:bg-neutral-100 focus:outline-hidden dark:text-neutral-200
            dark:hover:bg-neutral-800'
          onClick={() => setTheme('light')}
        >
          Light
        </DropdownMenuItem>
        <DropdownMenuItem
          className='cursor-pointer px-4 py-2 text-sm text-neutral-600 transition-colors
            hover:bg-neutral-100 focus:outline-hidden dark:text-neutral-200
            dark:hover:bg-neutral-800'
          onClick={() => setTheme('dark')}
        >
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem
          className='cursor-pointer px-4 py-2 text-sm text-neutral-600 transition-colors
            hover:bg-neutral-100 focus:outline-hidden dark:text-neutral-200
            dark:hover:bg-neutral-800'
          onClick={() => setTheme('system')}
        >
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
