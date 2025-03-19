import { ReactNode } from 'react';

export default function ResultLayout({ children }: { children: ReactNode }) {
  return <div className='w-full'>{children}</div>;
}
