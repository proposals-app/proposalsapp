'use client';

import { useEffect } from 'react';
import { updateLastReadAt } from '../actions';

interface LastReadUpdaterProps {
  groupId: string;
}

export const LastReadUpdater: React.FC<LastReadUpdaterProps> = ({
  groupId,
}) => {
  useEffect(() => {
    const updateLastRead = async () => {
      await updateLastReadAt(groupId);
    };

    updateLastRead();
  }, [groupId]);

  return null;
};
