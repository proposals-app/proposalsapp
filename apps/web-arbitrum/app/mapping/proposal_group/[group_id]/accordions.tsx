'use client';

import {
  DiscoursePost,
  IndexerVariant,
  Proposal,
  Selectable,
  Vote,
} from '@proposalsapp/db';
import * as Accordion from '@radix-ui/react-accordion';
import { ChevronDownIcon } from '@radix-ui/react-icons';
import Link from 'next/link';
import { TopicWithPosts } from './actions';

export function ProposalAccordion({
  proposals,
}: {
  proposals: (Selectable<Proposal> & {
    votes: Selectable<Vote>[];
    indexerVariant: IndexerVariant | null;
  })[];
}) {
  return (
    <Accordion.Root
      type='single'
      collapsible
      className='flex w-full flex-col gap-2'
    >
      {proposals.map((proposal) => {
        const sortedVotes = [...proposal.votes].sort(
          (a, b) =>
            (b.timeCreated ? new Date(b.timeCreated).getTime() : 0) -
            (a.timeCreated ? new Date(a.timeCreated).getTime() : 0)
        );

        return (
          <Accordion.Item key={proposal.id} value={proposal.id}>
            <Accordion.Header>
              <Accordion.Trigger className='flex w-full items-center justify-between rounded-md'>
                <Link
                  href={proposal.url}
                  target='_blank'
                  className='flex items-center gap-2'
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className='rounded-full bg-blue-100 px-2 py-1 text-xs font-medium dark:bg-blue-800'>
                    Proposal
                  </span>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                    proposal.indexerVariant?.includes('SNAPSHOT')
                        ? 'bg-yellow-100 dark:bg-yellow-800'
                        : 'bg-green-100 dark:bg-green-800'
                    }`}
                  >
                    {proposal.indexerVariant}
                  </span>
                  {proposal.name}
                </Link>
                <ChevronDownIcon className='h-4 w-4 transition-transform duration-200' />
              </Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content className='overflow-hidden p-4'>
              <div className='mb-2 font-semibold'>
                Choices: {JSON.stringify(proposal.choices)}
              </div>
              <h3 className='mb-2 font-semibold'>Votes:</h3>
              <ul className='space-y-2 text-sm'>
                {sortedVotes.map((vote: Selectable<Vote>) => (
                  <li key={vote.id} className='rounded-md border p-2'>
                    <span className='font-medium'>Timestamp:</span>{' '}
                    {vote.timeCreated?.toString()}
                    <br />
                    <span className='font-medium'>Address:</span>{' '}
                    {vote.voterAddress}
                    <br />
                    <span className='font-medium'>Choice:</span>{' '}
                    {JSON.stringify(vote.choice)}
                    <br />
                    <span className='font-medium'>Power:</span>{' '}
                    {vote.votingPower}
                    <br />
                    <span className='font-medium'>Reason:</span> {vote.reason}
                  </li>
                ))}
              </ul>
            </Accordion.Content>
          </Accordion.Item>
        );
      })}
    </Accordion.Root>
  );
}

export function TopicAccordion({ topics }: { topics: TopicWithPosts[] }) {
  return (
    <Accordion.Root type='single' collapsible className='w-full'>
      {topics.map((topic) => {
        const sortedPosts = [...topic.posts].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        return (
          <Accordion.Item key={topic.id} value={topic.id}>
            <Accordion.Header>
              <Accordion.Trigger className='flex w-full items-center justify-between rounded-md p-4'>
                <Link
                  href={`${topic.discourseBaseUrl}/t/${topic.externalId}`}
                  target='_blank'
                  className='flex items-center gap-2'
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className='rounded-full bg-gray-100 px-2 py-1 text-xs font-medium dark:bg-gray-800'>
                    Discussion
                  </span>
                  <span className='rounded-full bg-blue-100 px-2 py-1 text-xs font-medium dark:bg-blue-800'>
                    {topic.discourseBaseUrl}
                  </span>
                  {topic.title}
                </Link>
                <ChevronDownIcon className='h-4 w-4 transition-transform duration-200' />
              </Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content className='overflow-hidden p-4'>
              <h3 className='mb-2 font-semibold'>Posts:</h3>
              <ul className='space-y-4'>
                {sortedPosts.map((post: Selectable<DiscoursePost>) => (
                  <li key={post.id} className='rounded-lg border p-4 shadow-xs'>
                    <div className='mb-2 flex items-center'>
                      <span className='mr-2 font-medium'>User:</span>
                      <span>{post.username}</span>
                    </div>
                    <div className='mb-2'>
                      <span className='font-medium'>Timestamp:</span>{' '}
                      {post.createdAt.toString()}
                    </div>
                    <div>
                      <span className='font-medium'>Content:</span>
                      <p className='mt-1 leading-relaxed'>
                        {post.cooked.length > 500
                          ? post.cooked.substring(0, 500) + '...'
                          : post.cooked}
                      </p>
                      {post.cooked.length > 500 && (
                        <Link
                          href={`${topic.discourseBaseUrl}/t/${topic.externalId}/${post.postNumber}`}
                          target='_blank'
                          className='mt-2 inline-block text-sm text-blue-500 hover:underline'
                        >
                          Read more
                        </Link>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </Accordion.Content>
          </Accordion.Item>
        );
      })}
    </Accordion.Root>
  );
}

export function BackButton() {
  return (
    <Link
      href='/mapping'
      className='inline-flex items-center justify-center rounded-md border px-4 py-2'
    >
      Back to Mapping
    </Link>
  );
}
