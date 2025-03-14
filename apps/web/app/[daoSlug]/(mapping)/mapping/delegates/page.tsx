import { notFound } from 'next/navigation';
import { getDelegatesWithMappings } from './actions';
import { getDao } from '../actions';
import { DelegateRow } from './components/edit-delegate-row';

export default async function DelegatesMappingPage({
  params,
}: {
  params: Promise<{ daoSlug: string }>;
}) {
  const { daoSlug } = await params;
  const dao = await getDao(daoSlug);

  if (!dao) {
    notFound();
  }

  const delegatesWithMappings = await getDelegatesWithMappings(daoSlug);

  return (
    <div className='container mx-auto p-6'>
      <div className='mb-8'>
        <h1 className='text-3xl font-bold text-neutral-900 dark:text-neutral-100'>
          Delegate Mappings for {dao.name}
        </h1>
        <p className='mt-2 text-neutral-500 dark:text-neutral-400'>
          Manage delegate mappings for Discourse users and Voters in {dao.name}.
        </p>
      </div>
      <div className='overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-700'>
        <table className='min-w-full table-auto border-collapse'>
          <thead className='bg-neutral-100 dark:bg-neutral-800'>
            <tr>
              <th
                className='border-b border-neutral-200 px-6 py-3 text-left text-sm font-semibold
                  text-neutral-900 dark:border-neutral-700 dark:text-neutral-100'
              >
                Delegate ID
              </th>
              <th
                className='border-b border-neutral-200 px-6 py-3 text-left text-sm font-semibold
                  text-neutral-900 dark:border-neutral-700 dark:text-neutral-100'
              >
                Discourse User Mapping
              </th>
              <th
                className='border-b border-neutral-200 px-6 py-3 text-left text-sm font-semibold
                  text-neutral-900 dark:border-neutral-700 dark:text-neutral-100'
              >
                Voter Mapping
              </th>
              <th
                className='border-b border-neutral-200 px-6 py-3 text-left text-sm font-semibold
                  text-neutral-900 dark:border-neutral-700 dark:text-neutral-100'
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {delegatesWithMappings.map(
              ({ delegate, discourseUsers, voters }) => (
                <DelegateRow
                  key={delegate.id}
                  delegate={delegate}
                  discourseUsers={discourseUsers}
                  voters={voters}
                  daoSlug={daoSlug}
                />
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
