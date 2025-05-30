'use client';

import React from 'react';

interface MappingTableProps {
  headers: string[];
  children: React.ReactNode;
  className?: string;
  emptyState?: React.ReactNode;
}

/**
 * A reusable table component for mapping interfaces
 */
export const MappingTable: React.FC<MappingTableProps> = ({
  headers,
  children,
  className = '',
  emptyState,
}) => {
  // Check if children is empty (no rows)
  const hasRows = React.Children.count(children) > 0;

  return (
    <div
      className={`overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800 ${className}`}
    >
      <table className='min-w-full table-auto divide-y divide-neutral-200 dark:divide-neutral-800'>
        <thead className='bg-neutral-50 dark:bg-neutral-900'>
          <tr>
            {headers.map((header, index) => (
              <th
                key={index}
                scope='col'
                className={`px-6 py-3 text-left text-xs font-medium tracking-wider text-neutral-500 uppercase dark:text-neutral-400 ${index === headers.length - 1 ? 'w-[200px] min-w-[200px]' : ''}`}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className='divide-y divide-neutral-200 bg-white dark:divide-neutral-800 dark:bg-neutral-950'>
          {hasRows ? (
            children
          ) : (
            <tr>
              <td
                colSpan={headers.length}
                className='px-6 py-8 text-center text-neutral-500 dark:text-neutral-400'
              >
                {emptyState || 'No items found'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export const MappingTableRow: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  return (
    <tr
      className={`hover:bg-neutral-50 dark:hover:bg-neutral-900 ${className}`}
    >
      {children}
    </tr>
  );
};

export const MappingTableCell: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  return (
    <td
      className={`px-6 py-4 text-sm text-neutral-900 dark:text-neutral-100 ${className}`}
    >
      <div className='max-w-md break-words'>{children}</div>
    </td>
  );
};

export const MappingTableActionCell: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  return (
    <td
      className={`w-[200px] min-w-[200px] px-6 py-4 text-right text-sm font-medium ${className}`}
    >
      <div className='flex flex-wrap justify-end gap-2'>{children}</div>
    </td>
  );
};

export default MappingTable;
