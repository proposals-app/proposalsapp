import { getGroups } from './actions';
import { VirtualizedGroupList } from './components/VirtualizedGroupList';

export default async function ListPage({
  params,
}: {
  params: Promise<{ daoSlug: string }>;
}) {
  const { daoSlug } = await params;
  const result = await getGroups(daoSlug);

  if (!result) {
    return null;
  }

  const { daoName, groups } = result;

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
