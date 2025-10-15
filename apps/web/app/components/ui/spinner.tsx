import React from 'react';
import { cn } from '@/lib/utils';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Spinner({ size = 'md', className }: SpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  return (
    <div className='flex items-center justify-center'>
      <div
        className={cn(
          'rounded-full border-2 border-dashed border-neutral-300 border-t-neutral-500 bg-transparent dark:border-neutral-600 dark:border-t-neutral-400',
          sizeClasses[size],
          className
        )}
        style={{
          animation: 'spin 2s linear infinite',
          position: 'relative',
        }}
      >
        <div className='via-neutral-300/20 dark:via-neutral-600/20 absolute inset-0 rounded-full bg-gradient-to-r from-transparent to-transparent' />
      </div>
    </div>
  );
}
