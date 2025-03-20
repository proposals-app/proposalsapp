'use client';

import { markAllAsRead } from '../actions';
import { useParams, useRouter } from 'next/navigation';
import { useTransition } from 'react';

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
      className='border-neutral-350 dark:border-neutral-650 border bg-neutral-200 px-2 py-1
        text-sm text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200'
    >
      {isPending ? 'Marking all as read...' : 'Mark all as read'}
    </button>
  );
};
