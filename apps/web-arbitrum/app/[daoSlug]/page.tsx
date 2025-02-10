import { after } from 'next/server';
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
        <h1 className='mb-8 text-4xl font-bold text-neutral-700 dark:text-neutral-200'>
          {daoName || daoSlug}
        </h1>
        <VirtualizedGroupList groups={groups} />
      </div>
    </div>
  );
}
