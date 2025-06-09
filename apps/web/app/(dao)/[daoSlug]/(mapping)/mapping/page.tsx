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
  const dao = await getDao(daoSlug);
  const { proposalGroups } = await getGroupsData(daoSlug);
  const ungroupedProposals = await getUngroupedProposals(daoSlug);

  // Serialize the data with SuperJSON
  const serializedProps = superjson.stringify({
    proposalGroups,
    daoSlug,
    daoId: dao.id,
  });

  return (
    <div className='container mx-auto p-6'>
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

      {/* Ungrouped Proposals Section */}
      {ungroupedProposals.length > 0 && (
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
      )}

      {/* Group management interface */}
      <section>
        <GroupingInterface serializedProps={serializedProps} />
      </section>
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
