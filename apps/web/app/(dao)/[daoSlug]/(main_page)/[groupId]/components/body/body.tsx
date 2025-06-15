import { notFound } from 'next/navigation';
import type { BodyVersionType, GroupReturnType } from '../../actions';
import { BodyContent } from './body-content';
import { processMarkdown } from '@/lib/markdown-converter';
import { SkeletonBody } from '@/app/components/ui/skeleton';

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

export function BodyLoading() {
  return <SkeletonBody />;
}
