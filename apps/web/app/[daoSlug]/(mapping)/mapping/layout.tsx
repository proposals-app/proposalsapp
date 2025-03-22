export const metadata = {
  title: 'Proposal Groups Management',
  description: 'Create and manage proposal groups for your DAO',
};

export default async function GroupLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ daoSlug: string }>;
}) {
  return <div className='mx-auto w-full max-w-7xl'>{children}</div>;
}
