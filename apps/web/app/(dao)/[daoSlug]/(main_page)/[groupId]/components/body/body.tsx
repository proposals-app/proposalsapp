import { notFound } from 'next/navigation';
import type { BodyVersionType, GroupReturnType } from '../../actions';
import { BodyContent } from './body-content';
import { processMarkdown } from '@/lib/markdown-converter';
import Image from 'next/image';
import { SkeletonBodyHeader, SkeletonBody } from '@/app/components/ui/skeleton';

export function Body({
  group,
  diff,
  bodyVersions,
  currentVersion,
}: {
  group: GroupReturnType;
  diff: boolean;
  bodyVersions: BodyVersionType[];
  currentVersion: number;
}) {
  if (!group) {
    notFound();
  }

  if (!bodyVersions || bodyVersions.length === 0) {
    return <div className='w-full'>No bodies found.</div>;
  }

  const visibleBody = bodyVersions[currentVersion];
  const previousBody =
    diff && currentVersion > 0 ? bodyVersions[currentVersion - 1] : null;

  const processedContent = processMarkdown(
    visibleBody.content,
    previousBody?.content || null,
    diff,
    currentVersion,
    'body'
  );

  return (
    <div className='relative'>
      <BodyContent processedContent={processedContent} />
    </div>
  );
}

export function LoadingBodyHeader() {
  return <SkeletonBodyHeader />;
}

export function BodyLoading() {
  return <SkeletonBody />;
}

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
