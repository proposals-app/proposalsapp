'use client';

import React from 'react';

type BadgeVariant = 'blue' | 'green' | 'purple' | 'red' | 'neutral';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

/**
 * A consistent badge component for use across mapping interfaces
 */
export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'blue',
  className = '',
}) => {
  const getVariantClasses = () => {
    switch (variant) {
      case 'blue':
        return 'bg-blue-50 text-blue-700 ring-blue-700/10 dark:bg-blue-900/30 dark:text-blue-400 dark:ring-blue-400/20';
      case 'green':
        return 'bg-green-50 text-green-700 ring-green-700/10 dark:bg-green-900/30 dark:text-green-400 dark:ring-green-400/20';
      case 'purple':
        return 'bg-purple-50 text-purple-700 ring-purple-700/10 dark:bg-purple-900/30 dark:text-purple-400 dark:ring-purple-400/20';
      case 'red':
        return 'bg-red-50 text-red-700 ring-red-700/10 dark:bg-red-900/30 dark:text-red-400 dark:ring-red-400/20';
      case 'neutral':
        return 'bg-neutral-100 text-neutral-700 ring-neutral-700/10 dark:bg-neutral-800 dark:text-neutral-300 dark:ring-neutral-400/10';
      default:
        return 'bg-blue-50 text-blue-700 ring-blue-700/10 dark:bg-blue-900/30 dark:text-blue-400 dark:ring-blue-400/20';
    }
  };

  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${getVariantClasses()} ${className}`}
    >
      {children}
    </span>
  );
};

export default Badge;
