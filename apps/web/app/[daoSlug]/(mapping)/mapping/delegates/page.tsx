import { notFound } from 'next/navigation';
import { getDelegatesWithMappings } from './actions';
import { getDao } from '../actions';
import { DelegateRow, EditDelegateRow } from './components/edit-delegate-row';

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
    <div className='container mx-auto p-4'>
      <h1 className='mb-4 text-2xl font-bold text-neutral-900 dark:text-neutral-100'>
        Delegate Mappings for {dao.name}
      </h1>

      <div className='overflow-x-auto'>
        <table
          className='min-w-full table-auto border-collapse border border-neutral-200
            dark:border-neutral-700'
        >
          <thead className='bg-neutral-100 dark:bg-neutral-900'>
            <tr>
              <th className='border border-neutral-200 px-4 py-2 dark:border-neutral-700'>
                Delegate ID
              </th>
              <th className='border border-neutral-200 px-4 py-2 dark:border-neutral-700'>
                Discourse User Mapping
              </th>
              <th className='border border-neutral-200 px-4 py-2 dark:border-neutral-700'>
                Voter Mapping
              </th>
              <th className='border border-neutral-200 px-4 py-2 dark:border-neutral-700'>
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
