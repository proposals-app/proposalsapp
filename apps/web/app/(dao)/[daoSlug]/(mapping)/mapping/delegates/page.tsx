import { createDelegate, getDelegatesWithMappings } from './actions';
import { getDao } from '../actions';
import { DelegateRow } from './components/edit-delegate-row';
import { Suspense } from 'react';
import { Button, MappingTable, PageHeader } from '../components/ui';
import { Spinner } from '@/app/components/ui/spinner';

async function DelegatesPage({
  params,
}: {
  params: Promise<{ daoSlug: string }>;
}) {
  const { daoSlug } = await params;

  return (
    <div className='container mx-auto p-6'>
      <HeaderContainer daoSlug={daoSlug} />
      <DelegatesContainer daoSlug={daoSlug} />
    </div>
  );
}

// Header container that loads DAO info
async function HeaderContainer({ daoSlug }: { daoSlug: string }) {
  const dao = await getDao(daoSlug);

  return (
    <PageHeader
      title={`Delegate Mappings for ${dao?.name || 'Unknown DAO'}`}
      description={`Manage delegate mappings for Discourse users and Voters in ${dao?.name || 'the DAO'}.`}
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
  );
}

// Delegates container that loads delegates data independently
async function DelegatesContainer({ daoSlug }: { daoSlug: string }) {
  const delegatesWithMappings = await getDelegatesWithMappings(daoSlug);

  return (
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
  );
}

// Loading component for the entire page
function PageSpinner() {
  return (
    <div className='container mx-auto flex min-h-[50vh] items-center justify-center p-6'>
      <Spinner size='lg' />
    </div>
  );
}

export default async function Page({
  params,
}: {
  params: Promise<{ daoSlug: string }>;
}) {
  return (
    <Suspense fallback={<PageSpinner />}>
      <DelegatesPage params={params} />
    </Suspense>
  );
}
