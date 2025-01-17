import { notFound } from 'next/navigation';
import { fetchData } from './actions';
import GroupingInterface from './components/proposal-group';

export default async function MappingPage() {
  const { proposalGroups } = await fetchData();

  if (!proposalGroups) {
    notFound();
  }

  return (
    <div className='p-4'>
      <h1 className='mb-4 text-2xl font-bold'>Proposals Mapping</h1>
      <GroupingInterface initialGroups={proposalGroups} />
    </div>
  );
}
