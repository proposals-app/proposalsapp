'use client';

import React from 'react';

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
  const getVariantClasses = () => {
    switch (variant) {
      case 'primary':
        return 'border-brand-accent bg-brand-accent hover:bg-brand-accent-darker focus:ring-brand-accent text-white dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700';
      case 'secondary':
        return 'border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-100 focus:ring-neutral-500 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700';
      case 'danger':
        return 'border-red-500 bg-red-500 text-white hover:bg-red-600 focus:ring-red-500 dark:border-red-700 dark:bg-red-500 dark:hover:bg-red-600';
      case 'outline':
        return 'border-neutral-300 bg-transparent text-neutral-900 hover:bg-neutral-100 focus:ring-neutral-500 dark:border-neutral-600 dark:text-neutral-100 dark:hover:bg-neutral-800';
      default:
        return 'border-brand-accent bg-brand-accent hover:bg-brand-accent-darker focus:ring-brand-accent text-white dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700';
    }
  };

  return (
    <button
      type={type}
      onClick={onClick}
      className={`focus:ring-opacity-50 rounded-md border px-4 py-2 text-sm font-medium focus:ring-2 disabled:opacity-50 ${getVariantClasses()} ${
        fullWidth ? 'w-full' : ''
      } ${className}`}
      disabled={disabled || isLoading}
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
    </button>
  );
};

export default Button;
