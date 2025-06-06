'use client';

import { LogOutIcon } from 'lucide-react';
import { usePostHog } from 'posthog-js/react';
import { signOut } from '@/lib/auth/auth-client';
import { useRouter } from 'next/navigation';

export const SignOutButton = () => {
  const posthog = usePostHog();
  const router = useRouter();

  return (
    <div id='signout' className='flex justify-end'>
      <button
        onClick={async () => {
          posthog.reset();
          await signOut({
            fetchOptions: {
              onSuccess: () => {
                router.push('/profile');
              },
            },
          });
        }}
        className='inline-flex items-center justify-center rounded-xs bg-neutral-200 px-3 py-1.5 text-sm font-medium whitespace-nowrap text-neutral-900 hover:bg-neutral-300 disabled:pointer-events-none disabled:opacity-50 sm:px-4 sm:py-2 dark:bg-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-600'
      >
        <LogOutIcon className='mr-2 h-4 w-4' />
        Sign out
      </button>
    </div>
  );
};
