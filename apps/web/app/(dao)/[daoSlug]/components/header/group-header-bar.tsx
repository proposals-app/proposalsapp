import Link from 'next/link';
import Image from 'next/image';
import ArrowSvg from '@/public/assets/web/icons/arrow-left.svg';

interface GroupHeaderBarProps {
  groupId: string;
  withBack: boolean;
  originalAuthorName: string;
  originalAuthorPicture: string;
  groupName: string;
  className?: string;
  position?: 'fixed' | 'static';
}

export function GroupHeaderBar({
  groupId,
  withBack,
  originalAuthorName,
  originalAuthorPicture,
  groupName,
  className,
  position = 'fixed',
}: GroupHeaderBarProps) {
  const positionClassName =
    position === 'fixed'
      ? 'fixed left-0 right-0 top-0 md:left-20'
      : 'relative w-full';

  return (
    <div
      className={`${positionClassName} z-50 flex h-20 items-center border-b border-neutral-350 bg-neutral-50 px-3 transition-transform duration-300 dark:border-neutral-650 dark:bg-neutral-900 sm:px-4 md:px-6 ${className ?? ''}`}
    >
      {withBack && (
        <Link
          href={`/${groupId}`}
          className='flex items-center gap-2 rounded-full px-3 py-2'
        >
          <ArrowSvg width={24} height={24} />
          <span className='hidden text-sm font-medium sm:block'>Back</span>
        </Link>
      )}

      <div className='flex items-center gap-2 pl-2 sm:pl-4'>
        <div className='flex min-h-8 min-w-8 items-center justify-center overflow-hidden rounded-full border-2 border-neutral-700 dark:border-neutral-300 sm:h-10 sm:w-10'>
          <Image
            src={originalAuthorPicture}
            alt={originalAuthorName}
            className='object-cover'
            width={40}
            height={40}
          />
        </div>
        <h1
          className={`${withBack ? 'max-w-[260px]' : 'max-w-[300px]'} overflow-hidden overflow-ellipsis whitespace-nowrap text-base font-bold sm:max-w-full sm:text-lg`}
        >
          {groupName}
        </h1>
      </div>
    </div>
  );
}
