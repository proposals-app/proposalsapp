import { Link, Text } from '@react-email/components';
import * as React from 'react';

interface UnsubscribeProps {
  daoSlug?: string;
}

export const Unsubscribe = ({ daoSlug = 'example' }: UnsubscribeProps) => {
  return (
    <Text className='mt-8 text-center text-xs text-neutral-500 dark:text-neutral-400'>
      You are receiving this email because you subscribed to proposals.app
      <br />
      If you wish to stop receiving these emails, please{' '}
      <Link
        href={`https://${daoSlug}.proposals.app/profile`}
        className='text-neutral-600 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200'
      >
        unsubscribe
      </Link>
    </Text>
  );
};
