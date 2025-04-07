import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import superjson from 'superjson';
import { getVotingPowerRanking } from './actions';
import { LoadingChart, VpChart } from './components/vp-chart';
import Loading from './loading';

export default async function Page({
  params,
}: {
  params: Promise<{ daoSlug: string }>;
}) {
  return (
    <Suspense fallback={<Loading />}>
      <VotingPowerPage params={params} />
    </Suspense>
  );
}

async function VotingPowerPage({
  params,
}: {
  params: Promise<{ daoSlug: string }>;
}) {
  const { daoSlug } = await params;

  try {
    const chartData = await getVotingPowerRanking(daoSlug);
    const serializedChartData = superjson.serialize(chartData);

    return (
      <div className='container mx-auto p-4 py-10'>
        <Suspense fallback={<LoadingChart />}>
          <VpChart chartData={serializedChartData} />
        </Suspense>
      </div>
    );
  } catch (error) {
    console.error('Error fetching VP ranking:', error);
    if ((error as Error).message.includes('DAO not found')) {
      notFound();
    }
    // Render an error message or fallback UI for other errors
    return (
      <div className='container mx-auto p-4 py-10 text-center text-red-500'>
        Failed to load voting power ranking data.
      </div>
    );
  }
}
