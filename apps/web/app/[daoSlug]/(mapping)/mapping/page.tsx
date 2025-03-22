import superjson from 'superjson';
import { getDao, getGroupsData, getUngroupedProposals } from './actions';
import GroupingInterface from './components/proposal-group';
import Link from 'next/link';

export default async function MappingPage({
  params,
}: {
  params: Promise<{ daoSlug: string }>;
}) {
  'use cache';

  const { daoSlug } = await params;
  const dao = await getDao(daoSlug);
  const { proposalGroups } = await getGroupsData(daoSlug);
  const ungroupedProposals = await getUngroupedProposals(daoSlug);

  // Serialize the data with SuperJSON
  const serializedProps = superjson.stringify({
    proposalGroups,
    daoSlug,
    daoId: dao.id,
  });

  return (
    <div className='container mx-auto p-6'>
      <div className='mb-8 flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold text-neutral-900 dark:text-neutral-100'>
            Proposal Group Management for {dao.name}
          </h1>
          <p className='mt-2 text-neutral-500 dark:text-neutral-400'>
            Create and manage proposal groups to better organize and map
            proposals within {dao.name}.
          </p>
        </div>
        <div className='flex flex-col gap-2'>
          <Link
            href={`/mapping/delegates`}
            className='border-brand-accent bg-brand-accent hover:bg-brand-accent-darker
              focus:ring-brand-accent focus:ring-opacity-50 w-48 rounded-md border px-4 py-2
              text-center text-sm font-medium text-white transition-colors focus:ring-2
              disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-800
              dark:text-neutral-100 dark:hover:bg-neutral-700'
          >
            Delegate Mapping
          </Link>
        </div>
      </div>

      {/* Ungrouped Proposals Section */}
      {ungroupedProposals.length > 0 && (
        <div className='mb-8'>
          <h2 className='mb-4 text-xl font-semibold text-neutral-800 dark:text-neutral-200'>
            Ungrouped Proposals
          </h2>
          <div
            className='overflow-x-auto rounded-lg border border-neutral-200 bg-white shadow-sm
              dark:border-neutral-700 dark:bg-neutral-800 dark:shadow-md'
          >
            <table className='min-w-full table-auto border-collapse'>
              <thead className='bg-neutral-100 dark:bg-neutral-800'>
                <tr>
                  <th
                    className='border-b border-neutral-200 px-6 py-3 text-left text-sm font-semibold
                      text-neutral-900 dark:border-neutral-700 dark:text-neutral-100'
                  >
                    Type
                  </th>
                  <th
                    className='border-b border-neutral-200 px-6 py-3 text-left text-sm font-semibold
                      text-neutral-900 dark:border-neutral-700 dark:text-neutral-100'
                  >
                    Indexer
                  </th>
                  <th
                    className='border-b border-neutral-200 px-6 py-3 text-left text-sm font-semibold
                      text-neutral-900 dark:border-neutral-700 dark:text-neutral-100'
                  >
                    Name
                  </th>
                </tr>
              </thead>
              <tbody>
                {ungroupedProposals.map((proposal) => (
                  <tr
                    key={`${proposal.externalId}-${proposal.governorId}`}
                    className='border-b border-neutral-200 transition-colors hover:bg-neutral-50
                      dark:border-neutral-700 dark:hover:bg-neutral-700/30'
                  >
                    <td className='px-6 py-4 whitespace-nowrap'>
                      <span
                        className='rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800
                          dark:bg-blue-900/40 dark:text-blue-300'
                      >
                        Proposal
                      </span>
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap'>
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${
                        proposal.indexerName?.includes('SNAPSHOT')
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300'
                            : 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                        }`}
                      >
                        {proposal.indexerName}
                      </span>
                    </td>
                    <td className='px-6 py-4'>
                      <span className='truncate text-neutral-900 dark:text-neutral-100'>
                        {proposal.name}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Group management interface */}
      <section>
        <h2 className='mb-4 text-xl font-semibold text-neutral-800 dark:text-neutral-200'>
          Manage Groups
        </h2>
        <GroupingInterface serializedProps={serializedProps} />
      </section>
    </div>
  );
}
