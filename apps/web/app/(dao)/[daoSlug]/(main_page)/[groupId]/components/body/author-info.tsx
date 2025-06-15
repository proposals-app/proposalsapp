import Image from 'next/image';

export const AuthorInfo = ({
  authorName,
  authorPicture,
}: {
  authorName: string;
  authorPicture: string;
}) => (
  <div className='flex flex-row items-center gap-2'>
    <div className='flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 border-neutral-700 dark:border-neutral-300'>
      <Image
        src={authorPicture}
        alt={authorName}
        className='object-cover'
        fetchPriority='high'
        width={40}
        height={40}
      />
    </div>
    <div className='font-bold text-neutral-700 dark:text-neutral-200'>
      {authorName}
    </div>
  </div>
);