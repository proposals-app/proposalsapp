'use client';

import { UniswapActionBar } from './uniswap-action-bar';
import { markAllAsRead } from '../../[daoSlug]/actions';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

interface UniswapActionBarClientProps {
  hasNewActivity: boolean;
  signedIn: boolean;
}

export function UniswapActionBarClient({
  hasNewActivity,
  signedIn,
}: UniswapActionBarClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleMarkAllAsRead = async () => {
    startTransition(async () => {
      await markAllAsRead('uniswap');
      router.refresh();
    });
  };

  return (
    <UniswapActionBar
      hasNewActivity={hasNewActivity}
      signedIn={signedIn}
      onMarkAllAsRead={handleMarkAllAsRead}
      isMarkingAsRead={isPending}
    />
  );
}
