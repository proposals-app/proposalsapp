import { notFound } from 'next/navigation';
import { fetchData, fetchUngroupedProposals } from './actions';
import GroupingInterface from './components/proposal-group';

export default async function MappingPage({
  params,
}: {
  params: Promise<{ daoSlug: string }>;
}) {
  const { daoSlug } = await params;
  const { proposalGroups } = await fetchData(daoSlug);
  const ungroupedProposals = await fetchUngroupedProposals(daoSlug);
  if (!proposalGroups) notFound();

  return (
    <div className='p-4'>
      <h1 className='mb-4 text-2xl font-bold'>Proposals Mapping</h1>

      {/* Add Ungrouped Proposals Section */}
      {ungroupedProposals.length > 0 && (
        <div className='mb-8'>
          <h2 className='mb-4 text-xl font-semibold'>Ungrouped Proposals</h2>
          <div className='rounded-lg border p-4'>
            <ul className='space-y-2'>
              {ungroupedProposals.map((proposal) => (
                <li key={proposal.id} className='flex items-center gap-2'>
                  <span className='rounded-full bg-blue-100 px-2 py-1 text-xs font-medium'>
                    Proposal
                  </span>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                    proposal.indexerName.includes('SNAPSHOT')
                        ? 'bg-yellow-100'
                        : 'bg-green-100'
                    }`}
                  >
                    {proposal.indexerName}
                  </span>
                  <span>{proposal.name}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <GroupingInterface initialGroups={proposalGroups} daoSlug={daoSlug} />
    </div>
  );
}
