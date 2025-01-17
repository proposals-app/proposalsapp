'use client';

import * as React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@radix-ui/react-dropdown-menu';

export function ModeToggle() {
  const { setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className='inline-flex items-center justify-center rounded-md border p-2'
          aria-label='Toggle theme'
        >
          <Sun className='h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0' />
          <Moon className='absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100' />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align='end'
        className='min-w-[120px] rounded-md shadow-lg'
      >
        <DropdownMenuItem
          className='cursor-pointer px-4 py-2 text-sm'
          onClick={() => setTheme('light')}
        >
          Light
        </DropdownMenuItem>
        <DropdownMenuItem
          className='cursor-pointer px-4 py-2 text-sm'
          onClick={() => setTheme('dark')}
        >
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem
          className='cursor-pointer px-4 py-2 text-sm'
          onClick={() => setTheme('system')}
        >
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
