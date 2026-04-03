'use client';

import { Skeleton } from 'boneyard-js/react';
import type { ReactNode } from 'react';

type BoneyardShellProps = {
  name: string;
  fixture: ReactNode;
  className?: string;
};

export function BoneyardShell({
  name,
  fixture,
  className,
}: BoneyardShellProps) {
  return (
    <Skeleton
      name={name}
      loading={true}
      fixture={fixture}
      className={className}
      color='rgba(17,24,39,0.08)'
      darkColor='rgba(255,255,255,0.08)'
    >
      {fixture}
    </Skeleton>
  );
}
