import { ReactNode } from 'react';

export default function ItemLayout({ children }: { children: ReactNode }) {
  return <div className='pl-20'>{children}</div>;
}
