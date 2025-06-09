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

  return (
    <div className='container mx-auto p-6'>
      {/* Header loads immediately with basic DAO info */}
      <Suspense fallback={<LoadingPageHeader />}>
        <HeaderContainer daoSlug={daoSlug} />
      </Suspense>

      {/* Delegates table loads independently */}
      <Suspense fallback={<LoadingDelegatesTable />}>
        <DelegatesContainer daoSlug={daoSlug} />
      </Suspense>
    </div>
  );
}

// Header container that loads DAO info
async function HeaderContainer({ daoSlug }: { daoSlug: string }) {
  const dao = await getDao(daoSlug);

  return (
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

// Loading components
function LoadingPageHeader() {
  return (
    <div className='mb-8'>
      <div className='mb-2 h-8 w-64 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700' />
      <div className='mb-4 h-4 w-96 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700' />
      <div className='h-10 w-32 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700' />
    </div>
  );
}

function LoadingDelegatesTable() {
  return (
    <div className='rounded-lg border border-neutral-800 bg-white dark:border-neutral-700 dark:bg-neutral-950'>
      {/* Table header - small uppercase text */}
      <div className='border-b border-neutral-200 p-4 dark:border-neutral-800'>
        <div className='grid grid-cols-4 gap-16'>
          <div className='h-3 w-20 animate-pulse rounded bg-neutral-400 dark:bg-neutral-500' />
          <div className='h-3 w-36 animate-pulse rounded bg-neutral-400 dark:bg-neutral-500' />
          <div className='h-3 w-24 animate-pulse rounded bg-neutral-400 dark:bg-neutral-500' />
          <div className='h-3 w-16 animate-pulse rounded bg-neutral-400 dark:bg-neutral-500' />
        </div>
      </div>
      {/* Table rows */}
      <div className='divide-y divide-neutral-200 dark:divide-neutral-800'>
        {[...Array(6)].map((_, i) => (
          <div key={i} className='p-4'>
            <div className='grid grid-cols-4 items-start gap-16'>
              {/* Delegate ID - long UUID */}
              <div className='h-6 w-56 animate-pulse rounded bg-neutral-600 px-2 py-1 text-xs dark:bg-neutral-700' />
              {/* Discourse User Mapping */}
              <div className='space-y-2'>
                <div className='h-4 w-16 animate-pulse rounded bg-neutral-300 text-sm dark:bg-neutral-600' />
                <div className='space-y-1'>
                  <div className='h-6 w-12 animate-pulse rounded bg-neutral-700 px-2 py-1 text-xs dark:bg-neutral-800' />
                  <div className='h-6 w-20 animate-pulse rounded bg-neutral-700 px-2 py-1 text-xs dark:bg-neutral-800' />
                </div>
              </div>
              {/* Voter Mapping */}
              <div className='space-y-2'>
                <div className='h-4 w-14 animate-pulse rounded bg-neutral-300 text-sm dark:bg-neutral-600' />
                <div className='space-y-1'>
                  <div className='h-3 w-80 animate-pulse rounded bg-neutral-200 font-mono text-xs dark:bg-neutral-700' />
                  <div className='h-3 w-20 animate-pulse rounded bg-neutral-300 text-xs dark:bg-neutral-600' />
                </div>
              </div>
              {/* Actions */}
              <div className='h-8 w-28 animate-pulse rounded bg-blue-600 text-sm dark:bg-blue-500' />
            </div>
          </div>
        ))}
      </div>
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
