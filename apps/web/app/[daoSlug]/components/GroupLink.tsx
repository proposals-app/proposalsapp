'use client';

import Link from 'next/link';
import { useTransition } from 'react';
// import { setGroupLastSeenTimestamp } from '../actions';

interface GroupLinkProps {
  groupId: string;
  timestamp: number;
  children: React.ReactNode;
}

export function GroupLink({ groupId, children }: GroupLinkProps) {
  const [, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(() => {
      // setGroupLastSeenTimestamp(groupId, timestamp);
    });
  };

  return (
    <Link href={`/${groupId}`} prefetch={true} onClick={handleClick}>
      {children}
    </Link>
  );
}
