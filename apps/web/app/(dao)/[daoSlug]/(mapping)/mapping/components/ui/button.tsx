'use client';

import React from 'react';
import { Button as ShadcnButton } from '@/app/components/ui/button';
import { cn } from '@/lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'outline';

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  isLoading?: boolean;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  fullWidth?: boolean;
}

/**
 * A consistent button component for use across mapping interfaces
 * Now uses the main UI button component for consistency
 */
export const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
  disabled = false,
  isLoading = false,
  className = '',
  type = 'button',
  fullWidth = false,
}) => {
  // Map custom variants to Shadcn variants
  const getShadcnVariant = () => {
    switch (variant) {
      case 'primary':
        return 'default';
      case 'secondary':
        return 'secondary';
      case 'danger':
        return 'destructive';
      case 'outline':
        return 'outline';
      default:
        return 'default';
    }
  };

  return (
    <ShadcnButton
      type={type}
      onClick={onClick}
      variant={getShadcnVariant()}
      disabled={disabled || isLoading}
      className={cn(fullWidth && 'w-full', className)}
    >
      {isLoading ? (
        <div className='flex items-center justify-center'>
          <svg
            className='mr-2 h-4 w-4 animate-spin'
            xmlns='http://www.w3.org/2000/svg'
            fill='none'
            viewBox='0 0 24 24'
          >
            <circle
              className='opacity-25'
              cx='12'
              cy='12'
              r='10'
              stroke='currentColor'
              strokeWidth='4'
            ></circle>
            <path
              className='opacity-75'
              fill='currentColor'
              d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
            ></path>
          </svg>
          Loading...
        </div>
      ) : (
        children
      )}
    </ShadcnButton>
  );
};

export default Button;
