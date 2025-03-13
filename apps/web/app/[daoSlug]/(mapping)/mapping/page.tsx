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
        <h1 className='mb-6 text-2xl font-bold'>Proposal Groups Management</h1>

        {/* Ungrouped Proposals Section */}
        {ungroupedProposals.length > 0 && (
          <div className='mb-8'>
            <h2 className='mb-4 text-xl font-semibold text-gray-800'>
              Ungrouped Proposals
            </h2>
            <div className='rounded-lg border bg-gray-50 p-4'>
              <p className='mb-2 text-sm text-gray-500'>
                These proposals are not assigned to any group yet. Edit a group
                to add them.
              </p>
              <ul className='max-h-72 space-y-2 overflow-y-auto'>
                {ungroupedProposals.map((proposal) => (
                  <li
                    key={`${proposal.externalId}-${proposal.governorId}`}
                    className='flex items-center gap-2 rounded-md border bg-white p-2'
                  >
                    <span className='rounded-full bg-blue-100 px-2 py-1 text-xs font-medium'>
                      Proposal
                    </span>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                      proposal.indexerName?.includes('SNAPSHOT')
                          ? 'bg-yellow-100'
                          : 'bg-green-100'
                      }`}
                    >
                      {proposal.indexerName}
                    </span>
                    <span className='truncate'>{proposal.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Group management interface */}
        <section>
          <h2 className='mb-4 text-xl font-semibold text-gray-800'>
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
