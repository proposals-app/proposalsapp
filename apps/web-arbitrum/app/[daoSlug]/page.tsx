import Link from 'next/link';
import { after } from 'next/server';
import { Suspense } from 'react';
import { LazyLoadTrigger } from './components/LazyLoadTrigger';
import { getGroups_cached } from './actions';
import { getGroup_cached } from './(main_page)/[groupId]/actions';

export default async function ListPage({
  params,
  searchParams,
}: {
  params: Promise<{ daoSlug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { daoSlug } = await params;
  const { page } = await searchParams;

  const currentPage = page ? Number(page) : 1;
  const itemsPerPage = 25;

  // Use a Map to store unique groups
  const groupsMap = new Map<
    string,
    {
      id: string;
      name: string;
      daoId: string;
    }
  >();
  let daoName: string | null = null;

  for (let i = 1; i <= currentPage; i++) {
    const result = await getGroups_cached(daoSlug, i, itemsPerPage);

    if (!result || !Array.isArray(result.groups)) {
      continue;
    }

    if (i === 1) {
      daoName = result.daoName;
    }

    // Add groups to the Map using their ID as the key
    result.groups.forEach((group) => {
      groupsMap.set(group.id, group);
    });
  }

  // Convert Map values to array
  const allGroups = Array.from(groupsMap.values());

  after(async () => {
    await Promise.all(
      allGroups.map((group) => {
        getGroup_cached(daoSlug, group.id);
      })
    );
  });

  return (
    <div className='flex min-h-screen w-full flex-row'>
      <div className='w-full p-8'>
        <h1 className='mb-8 text-4xl font-bold'>{daoName || daoSlug}</h1>
        <div className='flex flex-col gap-4'>
          {allGroups.map((group) => (
            <Link
              key={group.id}
              href={`/${daoSlug}/${group.id}`}
              prefetch={true}
            >
              <div
                className='rounded-lg border border-neutral-200 bg-white p-6 shadow-sm transition-all
                  duration-200 hover:border-neutral-300 hover:shadow-md'
              >
                <h2 className='text-xl font-semibold text-neutral-700'>
                  {group.name}
                </h2>
                <p className='mt-2 text-sm text-neutral-500'>
                  View proposals and discussions in the {group.name} group.
                </p>
              </div>
            </Link>
          ))}
        </div>

        <Suspense fallback={<LoadingSkeleton />}>
          <LazyLoadTrigger
            currentPage={currentPage}
            hasMore={allGroups.length === currentPage * itemsPerPage}
          />
        </Suspense>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className='grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3'>
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
