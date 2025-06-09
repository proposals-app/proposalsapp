import superjson from 'superjson';
import {
  createGroup,
  getDao,
  getGroupsData,
  getUngroupedProposals,
} from './actions';
import GroupingInterface from './components/proposal-group';
import { Suspense } from 'react';
import {
  Badge,
  Button,
  MappingTable,
  MappingTableCell,
  MappingTableRow,
  PageHeader,
} from './components/ui';

async function MappingPage({
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

      {/* Ungrouped proposals load independently */}
      <Suspense fallback={<LoadingUngroupedSection />}>
        <UngroupedProposalsContainer daoSlug={daoSlug} />
      </Suspense>

      {/* Group management interface loads independently */}
      <Suspense fallback={<LoadingGroupInterface />}>
        <GroupManagementContainer daoSlug={daoSlug} />
      </Suspense>
    </div>
  );
}

// Header container that loads DAO info
async function HeaderContainer({ daoSlug }: { daoSlug: string }) {
  const dao = await getDao(daoSlug);

  return (
    <PageHeader
      title={`Proposal Group Management for ${dao.name}`}
      description={`Create and manage proposal groups to better organize and map proposals within ${dao.name}.`}
      actionLinks={[
        {
          href: '/mapping/delegates',
          label: 'Delegate Mapping',
        },
      ]}
    >
      <form
        action={async () => {
          'use server';
          await createGroup(daoSlug);
        }}
      >
        <Button type='submit' variant='primary' fullWidth>
          Create Group
        </Button>
      </form>
    </PageHeader>
  );
}

// Ungrouped proposals section that loads independently
async function UngroupedProposalsContainer({ daoSlug }: { daoSlug: string }) {
  const ungroupedProposals = await getUngroupedProposals(daoSlug);

  if (ungroupedProposals.length === 0) return null;

  return (
    <div className='mb-8'>
      <h2 className='mb-4 text-xl font-semibold text-neutral-800 dark:text-neutral-200'>
        Ungrouped Proposals
      </h2>
      <MappingTable
        headers={['Type', 'Indexer', 'Name']}
        emptyState={
          <div className='py-8 text-center'>
            <p className='text-neutral-500 dark:text-neutral-400'>
              No ungrouped proposals found
            </p>
            <p className='mt-1 text-sm text-neutral-400 dark:text-neutral-500'>
              All proposals have been assigned to groups
            </p>
          </div>
        }
      >
        {ungroupedProposals.map((proposal) => (
          <MappingTableRow
            key={`${proposal.externalId}-${proposal.governorId}`}
          >
            <MappingTableCell>
              <div className='flex-shrink-0'>
                <Badge variant='blue'>Proposal</Badge>
              </div>
            </MappingTableCell>
            <MappingTableCell>
              <div className='flex-shrink-0'>
                <Badge
                  variant={
                    proposal.indexerName?.includes('SNAPSHOT')
                      ? 'purple'
                      : 'green'
                  }
                >
                  {proposal.indexerName}
                </Badge>
              </div>
            </MappingTableCell>
            <MappingTableCell>
              <div className='min-w-0 flex-1'>
                <span
                  className='text-neutral-900 dark:text-neutral-100'
                  title={proposal.name}
                >
                  {proposal.name}
                </span>
              </div>
            </MappingTableCell>
          </MappingTableRow>
        ))}
      </MappingTable>
    </div>
  );
}

// Group management interface that loads independently
async function GroupManagementContainer({ daoSlug }: { daoSlug: string }) {
  const [dao, { proposalGroups }] = await Promise.all([
    getDao(daoSlug),
    getGroupsData(daoSlug),
  ]);

  // Serialize the data with SuperJSON
  const serializedProps = superjson.stringify({
    proposalGroups,
    daoSlug,
    daoId: dao.id,
  });

  return (
    <section>
      <GroupingInterface serializedProps={serializedProps} />
    </section>
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

function LoadingUngroupedSection() {
  return (
    <div className='mb-8'>
      <div className='mb-4 h-6 w-48 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700' />
      <div className='rounded-lg border border-neutral-800 bg-white dark:border-neutral-700 dark:bg-neutral-950'>
        {/* Table header - small uppercase text */}
        <div className='border-b border-neutral-200 p-4 dark:border-neutral-800'>
          <div className='grid grid-cols-3 gap-40'>
            <div className='h-3 w-8 animate-pulse rounded bg-neutral-400 dark:bg-neutral-500' />
            <div className='h-3 w-14 animate-pulse rounded bg-neutral-400 dark:bg-neutral-500' />
            <div className='h-3 w-9 animate-pulse rounded bg-neutral-400 dark:bg-neutral-500' />
          </div>
        </div>
        {/* Single table row */}
        <div className='p-4'>
          <div className='grid grid-cols-3 items-center gap-40'>
            <div className='h-6 w-16 animate-pulse rounded bg-blue-600 px-2 py-1 text-xs dark:bg-blue-500' />
            <div className='h-6 w-18 animate-pulse rounded bg-green-600 px-2 py-1 text-xs dark:bg-green-500' />
            <div className='h-4 w-72 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700' />
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingGroupInterface() {
  return (
    <div className='space-y-4'>
      <div className='rounded-lg border border-neutral-800 bg-white dark:border-neutral-700 dark:bg-neutral-950'>
        {/* Table header - small uppercase text */}
        <div className='border-b border-neutral-200 p-4 dark:border-neutral-800'>
          <div className='grid grid-cols-3 gap-32'>
            <div className='h-3 w-12 animate-pulse rounded bg-neutral-400 dark:bg-neutral-500' />
            <div className='h-3 w-11 animate-pulse rounded bg-neutral-400 dark:bg-neutral-500' />
            <div className='h-3 w-15 animate-pulse rounded bg-neutral-400 dark:bg-neutral-500' />
          </div>
        </div>
        {/* Table rows */}
        <div className='divide-y divide-neutral-200 dark:divide-neutral-800'>
          {[...Array(4)].map((_, i) => (
            <div key={i} className='p-4'>
              <div className='grid grid-cols-3 items-start gap-32'>
                {/* Group name - long proposal title */}
                <div className='space-y-1'>
                  <div className='h-5 w-96 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700' />
                </div>
                {/* Items count and details */}
                <div className='space-y-2'>
                  <div className='h-4 w-14 animate-pulse rounded bg-neutral-300 text-sm dark:bg-neutral-600' />
                  <div className='rounded border border-neutral-700 bg-neutral-800 p-2 dark:border-neutral-600 dark:bg-neutral-900'>
                    <div className='mb-1 flex items-center gap-2'>
                      <div className='h-5 w-10 animate-pulse rounded bg-purple-600 px-1 text-xs dark:bg-purple-500' />
                      <div className='h-3 w-64 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700' />
                    </div>
                    <div className='h-3 w-48 animate-pulse rounded bg-neutral-300 dark:bg-neutral-600' />
                  </div>
                </div>
                {/* Actions */}
                <div className='flex gap-2'>
                  <div className='h-8 w-10 animate-pulse rounded bg-neutral-400 dark:bg-neutral-500' />
                  <div className='h-8 w-14 animate-pulse rounded bg-red-600 dark:bg-red-500' />
                </div>
              </div>
            </div>
          ))}
        </div>
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
      <MappingPage params={params} />
    </Suspense>
  );
}
