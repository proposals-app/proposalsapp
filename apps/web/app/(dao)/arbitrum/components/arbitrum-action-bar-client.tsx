'use client';

import { ArbitrumActionBar } from './arbitrum-action-bar';
import { markAllAsRead } from '../../[daoSlug]/actions';
import { useParams, useRouter } from 'next/navigation';
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
    <ArbitrumActionBar
      hasNewActivity={hasNewActivity}
      signedIn={signedIn}
      onMarkAllAsRead={handleMarkAllAsRead}
      isMarkingAsRead={isPending}
    />
  );
}
