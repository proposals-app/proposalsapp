import type { ReactNode } from 'react';
export const experimental_ppr = true;

export default function ResultLayout({ children }: { children: ReactNode }) {
  return <div className='w-full sm:pl-40'>{children}</div>;
}
