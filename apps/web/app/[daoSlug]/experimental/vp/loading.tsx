import { LoadingChart } from './components/vp-chart'; // Re-use the chart loading component

export default function Loading() {
  return (
    <div className='container mx-auto p-4 py-10'>
      <h1 className='mb-4 h-8 w-1/2 animate-pulse rounded bg-neutral-200 text-center text-2xl font-bold dark:bg-neutral-700'></h1>
      <LoadingChart />
    </div>
  );
}
