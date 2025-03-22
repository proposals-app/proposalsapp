export const metadata = {
  title: 'Delegates Management',
  description: 'Create and manage delegates',
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
