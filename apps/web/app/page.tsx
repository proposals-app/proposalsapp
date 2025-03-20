import { Suspense } from 'react';
import Banner from './components/banner';

export default async function Home() {
  return (
    <div className='flex w-full flex-col items-center p-8'>
      <h2 className='text-xl font-semibold'>coming soon</h2>
      <Suspense>
        <Banner />
      </Suspense>
    </div>
  );
}
