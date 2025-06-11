'use client';

import React from 'react';
import { Button as ShadcnButton } from '@/app/components/ui/button';
import { Spinner } from '@/app/components/ui/spinner';
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
          <Spinner size='sm' className='mr-2' />
          Loading...
        </div>
      ) : (
        children
      )}
    </ShadcnButton>
  );
};

export default Button;
