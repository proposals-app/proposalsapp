'use client';

import { markAllAsRead } from '../actions';
import { useParams, useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Check } from 'lucide-react';

export const MarkAllAsReadButton = () => {
  const router = useRouter();
  const params = useParams();
  const daoSlug = params?.daoSlug as string;
  const [isPending, startTransition] = useTransition();

  const handleMarkAllAsRead = async () => {
    startTransition(async () => {
      await markAllAsRead(daoSlug);
      router.refresh();
    });
  };

  return (
    <button
      onClick={handleMarkAllAsRead}
      disabled={isPending}
      className='flex items-center gap-2 border border-neutral-200 bg-white px-4 py-1.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-70 dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-600'
    >
      <Check className='h-4 w-4' />
      {isPending ? 'Marking as read...' : 'Mark all as read'}
    </button>
  );
};
