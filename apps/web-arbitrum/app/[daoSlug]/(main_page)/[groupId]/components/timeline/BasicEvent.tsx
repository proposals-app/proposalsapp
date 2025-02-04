import Link from 'next/link';
import Image from 'next/image';

interface BasicEventProps {
  content: string;
  timestamp: Date;
  url: string;
  last: boolean;
}

export function BasicEvent({ content, url, last }: BasicEventProps) {
  return (
    <div className='relative my-1 mr-4 flex h-8 w-full items-center'>
      <div
        className='flex h-full w-full items-center justify-between rounded-xs border
          border-neutral-300 bg-neutral-100 px-4 py-1'
      >
        <Image
          className='absolute top-1 left-1 z-20'
          src='/assets/web/timeline_event.svg'
          width={24}
          height={24}
          alt={'Timeline event'}
        />
        {!last && (
          <div
            className='absolute top-0 left-3 z-10 h-[15px] max-h-[15px] w-0.5 translate-x-[3px]
              bg-neutral-800'
          />
        )}
        <div className='ml-2 text-xs'>{content}</div>
        {url && (
          <Link href={url} target='_blank'>
            <Image
              src='/assets/web/arrow_external_link.svg'
              width={24}
              height={24}
              alt={'Go to event'}
            />
          </Link>
        )}
      </div>
    </div>
  );
}
