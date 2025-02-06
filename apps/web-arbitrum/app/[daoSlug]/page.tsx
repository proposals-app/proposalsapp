import { after } from 'next/server';
import { Suspense } from 'react';
import { getGroups_cached } from './actions';
import { getGroup_cached } from './(main_page)/[groupId]/actions';
import { VirtualizedGroupList } from './components/VirtualizedGroupList';

export default async function ListPage({
  params,
}: {
  params: Promise<{ daoSlug: string }>;
}) {
  const { daoSlug } = await params;

  // Load all groups at once
  const result = await getGroups_cached(daoSlug);

  if (!result) {
    return null;
  }

  const { daoName, groups } = result;

  after(async () => {
    await Promise.all(
      groups.map((group) => {
        getGroup_cached(daoSlug, group.id);
      })
    );
  });

  return (
    <div className='flex min-h-screen w-full flex-row'>
      <div className='w-full p-8'>
        <h1 className='mb-8 text-4xl font-bold'>{daoName || daoSlug}</h1>
        <Suspense fallback={<LoadingSkeleton />}>
          <VirtualizedGroupList groups={groups} />
        </Suspense>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className='flex flex-col gap-4'>
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className='animate-pulse rounded-lg border border-neutral-200 bg-white p-6'
        >
          <div className='h-6 w-3/4 rounded-md bg-neutral-200' />
          <div className='mt-2 h-4 w-full rounded-md bg-neutral-200' />
          <div className='mt-4 h-4 w-1/2 rounded-md bg-neutral-200' />
        </div>
      ))}
    </div>
  );
}
