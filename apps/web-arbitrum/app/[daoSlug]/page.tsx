import { unstable_cache } from 'next/cache';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { after } from 'next/server';
import { Suspense } from 'react';
import { getGroupData } from './[groupId]/actions';
import { getGroups } from './actions';
import { LazyLoadTrigger } from './components/LazyLoadTrigger';

const getCachedGroups = unstable_cache(
  async (daoSlug: string, page: number, itemsPerPage: number) => {
    return await getGroups(daoSlug, page, itemsPerPage);
  },
  ['getGroups'],
  { revalidate: 60 * 5, tags: ['groups'] }
);

const cachedGetGroupData = unstable_cache(
  async (daoSlug: string, groupId: string) => {
    return await getGroupData(daoSlug, groupId);
  },
  ['group-data'],
  { revalidate: 60 * 5, tags: ['group-data'] }
);

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
    const result = await getCachedGroups(daoSlug, i, itemsPerPage);

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

  if (!allGroups.length) {
    notFound();
  }

  after(async () => {
    await Promise.all(
      allGroups.map((group) => {
        cachedGetGroupData(daoSlug, group.id);
      })
    );
  });

  return (
    <div className='flex min-h-screen w-full flex-row bg-brand-50 pl-20 dark:bg-brand-900'>
      <div className='w-full p-8'>
        <h1 className='mb-8 text-4xl font-bold text-brand-700 dark:text-brand-100'>
          {daoName || daoSlug}
        </h1>
        <div className='flex flex-col gap-4'>
          {allGroups.map((group) => (
            <Link
              key={group.id}
              href={`/${daoSlug}/${group.id}`}
              prefetch={true}
            >
              <div
                className='rounded-lg border border-brand-350 p-6 shadow-sm transition-shadow duration-200
                  hover:shadow-md dark:border-brand-800'
              >
                <h2 className='text-xl font-semibold text-brand-700 dark:text-brand-100'>
                  {group.name}
                </h2>
                <p className='mt-2 text-sm'>
                  View proposals and discussions in the {group.name} group.
                </p>
              </div>
            </Link>
          ))}
        </div>

        <Suspense fallback={<LoadingSkeleton />}>
          <LazyLoadTrigger currentPage={currentPage} />
        </Suspense>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className='grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3'>
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className='animate-pulse rounded-lg border p-6'>
          <div className='h-6 w-3/4 rounded-md' />
          <div className='mt-2 h-4 w-full rounded-md' />
          <div className='mt-4 h-4 w-1/2 rounded-md' />
        </div>
      ))}
    </div>
  );
}
