import { InitiallyPosted } from './initially-posted';
import { PostedRevisions } from './posted-revision';
import { AuthorInfo } from './author-info';
import { SkeletonBodyHeader } from '@/app/components/ui/skeleton';
import type { BodyVersionNoContentType } from '../../actions';

export function BodyHeader({
  groupName,
  originalAuthorName,
  originalAuthorPicture,
  firstBodyVersionCreatedAt,
  bodyVersionsNoContent,
}: {
  groupName: string;
  originalAuthorName: string;
  originalAuthorPicture: string;
  firstBodyVersionCreatedAt: Date;
  bodyVersionsNoContent: BodyVersionNoContentType[];
}) {
  return (
    <div className='flex w-full flex-col gap-6'>
      <div className='hidden flex-col gap-6 sm:flex'>
        <h1 className='text-2xl font-bold text-neutral-700 dark:text-neutral-300'>
          {groupName}
        </h1>

        <div className='flex flex-col'>
          <div className='flex flex-row items-start justify-between'>
            <AuthorInfo
              authorName={originalAuthorName}
              authorPicture={originalAuthorPicture}
            />

            <div className='flex flex-col items-center gap-2'>
              <div className='flex gap-2'>
                <InitiallyPosted createdAt={firstBodyVersionCreatedAt} />

                <PostedRevisions versions={bodyVersionsNoContent} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className='flex flex-col gap-2 sm:hidden'>
        <div className='flex items-start justify-between'>
          <AuthorInfo
            authorName={originalAuthorName}
            authorPicture={originalAuthorPicture}
          />

          <div className='flex-col'>
            <PostedRevisions versions={bodyVersionsNoContent} />
          </div>
        </div>

        <h1 className='text-center text-2xl font-bold text-neutral-700 dark:text-neutral-300'>
          {groupName}
        </h1>
      </div>
    </div>
  );
}

export function BodyHeaderLoading() {
  return <SkeletonBodyHeader />;
}
