import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

interface BasicEventProps {
  content: string;
  timestamp: Date;
  url: string;
  last: boolean;
}

export function BasicEvent({ content, url, last }: BasicEventProps) {
  return (
    <div className='relative mr-4 flex h-8 w-full items-center py-2'>
      <div
        className='flex w-full items-center justify-between border border-neutral-800 bg-white px-4
          py-1'
      >
        <div className='absolute top-3 left-3 z-20 h-[7px] w-[7px] rounded-full bg-neutral-500' />
        {!last && (
          <div
            className='absolute top-[1px] left-3 z-10 h-[15px] max-h-[15px] w-0.5 translate-x-[2.5px]
              bg-neutral-500'
          />
        )}
        <div className='ml-2 text-xs'>{content}</div>
        {url && (
          <Link href={url} target='_blank'>
            <ArrowUpRight size={14} />
          </Link>
        )}
      </div>
    </div>
  );
}
