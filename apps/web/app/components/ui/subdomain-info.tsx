'use client';

import { useEffect, useState } from 'react';
import { extractSubdomainInfo } from '@/lib/subdomain/utils';

export function SubdomainInfo() {
  const [info, setInfo] = useState({
    subdomain: 'Loading...',
    isSpecialSubdomain: false,
    rootDomain: 'Loading...',
    isDevelopment: false,
    hostname: 'Loading...',
  });

  useEffect(() => {
    // Only runs on client-side
    const hostname = window.location.hostname;
    const subdomainInfo = extractSubdomainInfo(hostname);
    setInfo({
      ...subdomainInfo,
      subdomain: subdomainInfo.subdomain || 'None',
    });
  }, []);

  if (process.env.NODE_ENV === 'production') {
    return null; // Don't show in production
  }

  return (
    <div className='fixed right-0 bottom-0 z-50 m-4 max-w-xs overflow-hidden rounded bg-white p-4 text-sm shadow-lg dark:bg-gray-800'>
      <div className='mb-2 flex items-center justify-between'>
        <h3 className='font-bold text-gray-800 dark:text-white'>
          Subdomain Debug
        </h3>
        <span
          className={`rounded px-2 py-1 ${info.isDevelopment ? 'bg-yellow-200 text-yellow-800' : 'bg-green-200 text-green-800'}`}
        >
          {info.isDevelopment ? 'DEV' : 'PROD'}
        </span>
      </div>

      <div className='space-y-1 text-gray-700 dark:text-gray-300'>
        <div>
          <span className='font-semibold'>Hostname:</span> {info.hostname}
        </div>
        <div>
          <span className='font-semibold'>Root Domain:</span> {info.rootDomain}
        </div>
        <div>
          <span className='font-semibold'>Subdomain:</span>{' '}
          {info.subdomain ? (
            <span
              className={
                info.isSpecialSubdomain
                  ? 'font-medium text-blue-600 dark:text-blue-400'
                  : ''
              }
            >
              {info.subdomain}
              {info.isSpecialSubdomain && ' ⭐'}
            </span>
          ) : (
            <span className='text-gray-500'>(none)</span>
          )}
        </div>
      </div>
    </div>
  );
}
