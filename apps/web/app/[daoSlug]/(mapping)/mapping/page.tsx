import { notFound } from 'next/navigation';
import superjson from 'superjson';
import { getDao, getGroupsData, getUngroupedProposals } from './actions';
import GroupingInterface from './components/proposal-group';

export default async function MappingPage({
  params,
}: {
  params: Promise<{ daoSlug: string }>;
}) {
  const { daoSlug } = await params;

  try {
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
      <div className='container mx-auto p-4'>
        <h1 className='mb-6 text-2xl font-bold text-neutral-900 dark:text-neutral-100'>
          Proposal Groups Management
        </h1>

        {/* Ungrouped Proposals Section */}
        {ungroupedProposals.length > 0 && (
          <div className='mb-8'>
            <h2 className='mb-4 text-xl font-semibold text-neutral-800 dark:text-neutral-200'>
              Ungrouped Proposals
            </h2>
            <div
              className='dark:bg-neutral-750 rounded-lg border border-neutral-300 bg-white p-4 shadow-xs
                dark:border-neutral-600 dark:bg-neutral-800'
            >
              <p className='mb-2 text-sm text-neutral-500 dark:text-neutral-400'>
                These proposals are not assigned to any group yet. Edit a group
                to add them.
              </p>
              <ul className='max-h-72 space-y-2 overflow-y-auto'>
                {ungroupedProposals.map((proposal) => (
                  <li
                    key={`${proposal.externalId}-${proposal.governorId}`}
                    className='flex items-center gap-2 rounded-md border border-neutral-300 bg-white p-2
                      dark:border-neutral-600 dark:bg-neutral-700'
                  >
                    <span
                      className='rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800
                        dark:bg-blue-900/40 dark:text-blue-300'
                    >
                      Proposal
                    </span>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                      proposal.indexerName?.includes('SNAPSHOT')
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300'
                          : 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                      }`}
                    >
                      {proposal.indexerName}
                    </span>
                    <span className='truncate text-neutral-900 dark:text-neutral-100'>
                      {proposal.name}
                    </span>
                  </li>
                ))}
              </ul>
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
  } catch (error) {
    console.error('Error loading mapping page:', error);
    notFound();
  }
}
