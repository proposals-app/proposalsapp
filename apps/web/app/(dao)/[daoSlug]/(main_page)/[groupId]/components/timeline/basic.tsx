import Link from 'next/link';
import TimelineEventIcon from '@/public/assets/web/icons/timeline-event.svg';
import OnchainEventIcon from '@/public/assets/web/icons/onchain.svg';
import OffchainEventIcon from '@/public/assets/web/icons/offchain.svg';
import DiscussionEventIcon from '@/public/assets/web/icons/discussion.svg';
import ExternalLinkIcon from '@/public/assets/web/icons/external-link.svg';
import { TimelineEventType } from '@/lib/types';

interface BasicProps {
  content: string;
  timestamp: Date;
  url: string;
  type: TimelineEventType;
}

export function Basic({ content, url, type }: BasicProps) {
  return (
    <div className='my-1 mr-4 flex h-8 w-full items-center pr-8'>
      <div className='text-neutral-650 flex h-full w-full items-center justify-between rounded-xs border border-neutral-300 bg-neutral-100 px-1 py-1 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'>
        <div className='flex items-center'>
          {type == TimelineEventType.Basic && (
            <TimelineEventIcon
              className='dark:fill-neutral-350 fill-neutral-800'
              width={24}
              height={24}
              alt={'Timeline event'}
            />
          )}

          {type == TimelineEventType.Discussion && (
            <DiscussionEventIcon
              className='dark:fill-neutral-350 fill-neutral-800'
              width={24}
              height={24}
              alt={'Timeline event'}
            />
          )}

          {type == TimelineEventType.Onchain && (
            <OnchainEventIcon
              className='dark:fill-neutral-350 fill-neutral-800'
              width={24}
              height={24}
              alt={'Timeline event'}
            />
          )}

          {type == TimelineEventType.Offchain && (
            <OffchainEventIcon
              className='dark:fill-neutral-350 fill-neutral-800'
              width={24}
              height={24}
              alt={'Timeline event'}
            />
          )}

          <div className='ml-2 text-xs'>{content}</div>
        </div>

        {url && (
          <Link href={url} target='_blank'>
            <ExternalLinkIcon
              width={24}
              height={24}
              alt={'Go to event'}
              className='fill-neutral-400 dark:fill-neutral-600'
            />
          </Link>
        )}
      </div>
    </div>
  );
}
