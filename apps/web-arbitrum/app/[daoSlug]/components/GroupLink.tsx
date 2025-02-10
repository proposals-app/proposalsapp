'use client';

import Link from 'next/link';

interface GroupLinkProps {
  groupId: string;
  children: React.ReactNode;
}

export function GroupLink({ groupId, children }: GroupLinkProps) {
  return (
    <Link href={`/${groupId}`} prefetch={true}>
      {children}
    </Link>
  );
}
