import Link from 'next/link';
import TimelineEventIcon from '@/public/assets/web/icons/timeline-event.svg';
import OnchainEventIcon from '@/public/assets/web/icons/onchain.svg';
import OffchainEventIcon from '@/public/assets/web/icons/offchain.svg';
import DiscussionEventIcon from '@/public/assets/web/icons/discussion.svg';
import ExternalLinkIcon from '@/public/assets/web/icons/external-link.svg';
import { TimelineEventType } from '@/lib/types';

interface BasicEventProps {
  content: string;
  timestamp?: Date;
  url?: string;
  type: TimelineEventType;
  showContent?: boolean;
  showExternalLink?: boolean;
}

const eventIcons = {
  [TimelineEventType.Basic]: TimelineEventIcon,
  [TimelineEventType.Discussion]: DiscussionEventIcon,
  [TimelineEventType.Onchain]: OnchainEventIcon,
  [TimelineEventType.Offchain]: OffchainEventIcon,
} as const;

type SupportedEventType = keyof typeof eventIcons;

export function BasicEvent({
  content,
  url,
  type,
  showContent = true,
  showExternalLink = true,
}: BasicEventProps) {
  const IconComponent = eventIcons[type as SupportedEventType];

  // For empty placeholder events
  if (!showContent) {
    return (
      <div className='relative mr-4 flex min-h-8 w-full items-center py-2'></div>
    );
  }

  return (
    <div className='my-1 mr-4 flex h-8 w-full items-center pr-8'>
      <div className='rounded-xs flex h-full w-full items-center justify-between border border-neutral-300 bg-neutral-100 px-1 py-1 text-neutral-650 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'>
        <div className='flex items-center'>
          {IconComponent && (
            <IconComponent
              className='fill-neutral-800 dark:fill-neutral-350'
              width={24}
              height={24}
              alt={'Timeline event'}
            />
          )}

          {showContent && <div className='ml-2 text-xs'>{content}</div>}
        </div>

        {showExternalLink && url && (
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
