import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Proposal Groups Management',
  description: 'Create and manage proposal groups for your DAO',
};

export default async function GroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className='mx-auto w-full max-w-7xl'>{children}</div>;
}
