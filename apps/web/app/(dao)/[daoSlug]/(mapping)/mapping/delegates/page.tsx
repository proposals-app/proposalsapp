import { createDelegate, getDelegatesWithMappings } from './actions';
import { getDao } from '../actions';
import { DelegateRow } from './components/edit-delegate-row';
import { Suspense } from 'react';
import { Button, MappingTable, PageHeader } from '../components/ui';

async function DelegatesPage({
  params,
}: {
  params: Promise<{ daoSlug: string }>;
}) {
  const { daoSlug } = await params;
  const dao = await getDao(daoSlug);

  const delegatesWithMappings = await getDelegatesWithMappings(daoSlug);

  return (
    <div className='container mx-auto p-6'>
      <PageHeader
        title={`Delegate Mappings for ${dao.name}`}
        description={`Manage delegate mappings for Discourse users and Voters in ${dao.name}.`}
        actionLinks={[
          {
            href: '/mapping',
            label: 'Proposal Mapping',
          },
        ]}
      >
        <form
          action={async () => {
            'use server';
            await createDelegate(daoSlug);
          }}
        >
          <Button type='submit' variant='primary' fullWidth>
            Create Delegate
          </Button>
        </form>
      </PageHeader>
      <Suspense>
        <MappingTable
          headers={[
            'Delegate ID',
            'Discourse User Mapping',
            'Voter Mapping',
            'Actions',
          ]}
          emptyState={
            <div className='py-8 text-center'>
              <p className='text-neutral-500 dark:text-neutral-400'>
                No delegates found
              </p>
              <p className='mt-1 text-sm text-neutral-400 dark:text-neutral-500'>
                Create a delegate to get started
              </p>
            </div>
          }
        >
          {delegatesWithMappings.map(({ delegate, discourseUsers, voters }) => (
            <DelegateRow
              key={delegate.id}
              delegate={delegate}
              discourseUsers={discourseUsers}
              voters={voters}
              daoSlug={daoSlug}
            />
          ))}
        </MappingTable>
      </Suspense>
    </div>
  );
}

export default async function Page({
  params,
}: {
  params: Promise<{ daoSlug: string }>;
}) {
  return (
    <Suspense>
      <DelegatesPage params={params} />
    </Suspense>
  );
}
