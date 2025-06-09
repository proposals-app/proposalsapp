import type { ReactNode } from 'react';

export default function ResultLayout({ children }: { children: ReactNode }) {
  return <div className='w-full pt-0 md:pt-0'>{children}</div>;
}
