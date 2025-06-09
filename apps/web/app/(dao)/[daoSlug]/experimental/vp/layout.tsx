import { Suspense, type ReactNode } from 'react';
import Loading from './loading';

export default function VpLayout({ children }: { children: ReactNode }) {
  return (
    <div className='w-full'>
      <Suspense fallback={<Loading />}>{children}</Suspense>
    </div>
  );
}
