'use client';

import { useEffect } from 'react';
import { updateLastReadAt } from '../actions';

interface LastReadUpdaterProps {
  groupId: string;
  daoSlug: string;
}

export const LastReadUpdater: React.FC<LastReadUpdaterProps> = ({
  groupId,
  daoSlug,
}) => {
  useEffect(() => {
    const updateLastRead = async () => {
      await updateLastReadAt(groupId, daoSlug);
    };

    updateLastRead();
  }, [groupId, daoSlug]);

  return null;
};
