'use client';

import React from 'react';
import Link from 'next/link';

interface PageHeaderProps {
  title: string;
  description: string;
  children?: React.ReactNode;
  actionLinks?: {
    href: string;
    label: string;
  }[];
}

/**
 * Consistent page header component for mapping interfaces
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  children,
  actionLinks = [],
}) => {
  return (
    <div className='mb-8 flex items-center justify-between'>
      <div>
        <h1 className='text-3xl font-bold text-neutral-900 dark:text-neutral-100'>
          {title}
        </h1>
        <p className='mt-2 text-neutral-500 dark:text-neutral-400'>
          {description}
        </p>
      </div>
      <div className='flex flex-col gap-2'>
        {actionLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className='focus:ring-opacity-50 border-brand-accent bg-brand-accent hover:bg-brand-accent-darker focus:ring-brand-accent w-48 rounded-md border px-4 py-2 text-center text-sm font-medium text-white focus:ring-2 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700'
          >
            {link.label}
          </Link>
        ))}
        {children}
      </div>
    </div>
  );
};

export default PageHeader;
