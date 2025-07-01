'use client';

import { ArbitrumActionBar } from './arbitrum-action-bar';
import { markAllAsRead } from '../../[daoSlug]/actions';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

interface ArbitrumActionBarClientProps {
  hasNewActivity: boolean;
  signedIn: boolean;
}

export function ArbitrumActionBarClient({
  hasNewActivity,
  signedIn,
}: ArbitrumActionBarClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleMarkAllAsRead = async () => {
    startTransition(async () => {
      await markAllAsRead('arbitrum');
      router.refresh();
    });
  };

  return (
    <ArbitrumActionBar
      hasNewActivity={hasNewActivity}
      signedIn={signedIn}
      onMarkAllAsRead={handleMarkAllAsRead}
      isMarkingAsRead={isPending}
    />
  );
}
