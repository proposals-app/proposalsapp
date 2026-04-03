/* eslint-disable @typescript-eslint/no-explicit-any */

import superjson from 'superjson';
import type { ComponentProps } from 'react';
import { ArbitrumSummaryHeader } from '@/app/(dao)/arbitrum/components/arbitrum-summary-header';
import { ArbitrumActionBar } from '@/app/(dao)/arbitrum/components/arbitrum-action-bar';
import { UniswapSummaryHeader } from '@/app/(dao)/uniswap/components/uniswap-summary-header';
import { GroupList } from '@/app/(dao)/[daoSlug]/components/group-list';
import { ActiveGroupItem } from '@/app/(dao)/[daoSlug]/components/group-items/active-item';
import { InactiveGroupItem } from '@/app/(dao)/[daoSlug]/components/group-items/inactive-item';
import { DiscussionGroupItem } from '@/app/(dao)/[daoSlug]/components/group-items/discussion-item';
import { BodyHeader } from '@/app/(dao)/[daoSlug]/(main_page)/[groupId]/components/body/body-header';
import { BodyContent } from '@/app/(dao)/[daoSlug]/(main_page)/[groupId]/components/body/body-content';
import { InitiallyPosted } from '@/app/(dao)/[daoSlug]/(main_page)/[groupId]/components/body/initially-posted';
import { PostedRevisions } from '@/app/(dao)/[daoSlug]/(main_page)/[groupId]/components/body/posted-revision';
import { MenuBar } from '@/app/(dao)/[daoSlug]/(main_page)/[groupId]/components/menubar/menu-bar';
import { BodyViewBar } from '@/app/(dao)/[daoSlug]/(main_page)/[groupId]/components/menubar/body-view-bar';
import { CommentsViewBar } from '@/app/(dao)/[daoSlug]/(main_page)/[groupId]/components/menubar/comments-view-bar';
import { ViewEnum } from '@/app/(dao)/[daoSlug]/(main_page)/[groupId]/components/menubar/menu-bar';
import { PostContent } from '@/app/(dao)/[daoSlug]/(main_page)/[groupId]/components/feed/items/post-item/post-item-content';
import { VoteItem } from '@/app/(dao)/[daoSlug]/(main_page)/[groupId]/components/feed/items/vote-item/vote-item';
import { AggregateVoteItem } from '@/app/(dao)/[daoSlug]/(main_page)/[groupId]/components/feed/items/vote-item/aggregate-vote-item';
import { ResultsTitle } from '@/app/(dao)/[daoSlug]/(results_page)/[groupId]/vote/[resultNumber]/components/result/results-title';
import {
  ResultsList,
  ResultsListBars,
} from '@/app/(dao)/[daoSlug]/(results_page)/[groupId]/vote/[resultNumber]/components/result/results-list';
import { ResultsTable } from '@/app/(dao)/[daoSlug]/(results_page)/[groupId]/vote/[resultNumber]/components/result/results-table';
import { NonVotersTable } from '@/app/(dao)/[daoSlug]/(results_page)/[groupId]/vote/[resultNumber]/components/result/non-voters-table';
import { ResultsChart } from '@/app/(dao)/[daoSlug]/(results_page)/[groupId]/vote/[resultNumber]/components/result/results-chart';
import { Result } from '@/app/(dao)/[daoSlug]/(results_page)/[groupId]/vote/[resultNumber]/components/timeline/result';
import {
  Basic,
  CommentsVolume,
  VotesVolume,
} from '@/app/(dao)/[daoSlug]/(results_page)/[groupId]/vote/[resultNumber]/components/timeline/other';
import { TimelineEventType } from '@/lib/types';
import TimelineEventIcon from '@/public/assets/web/icons/timeline-event.svg';
import { GroupHeaderBar } from '@/app/(dao)/[daoSlug]/components/header/group-header-bar';
import { NavBarContent } from '@/app/(dao)/[daoSlug]/components/navigation/nav-bar-content';
import { ModeToggle } from '@/app/(dao)/[daoSlug]/components/navigation/theme-switch';
import { UserSettings } from '@/app/(dao)/[daoSlug]/(user)/profile/components/user-settings';
import { AccountManagement } from '@/app/(dao)/[daoSlug]/(user)/profile/components/account-management';
import { SignOutButton } from '@/app/(dao)/[daoSlug]/(user)/profile/components/sign-out-button';
import { EmailPreferences } from '@/app/(dao)/[daoSlug]/(user)/onboarding/components/email-preferences';
import {
  Badge,
  MappingTable,
  MappingTableCell,
  MappingTableRow,
  PageHeader,
} from '@/app/(dao)/[daoSlug]/(mapping)/mapping/components/ui';
import MappingButton from '@/app/(dao)/[daoSlug]/(mapping)/mapping/components/ui/button';

const FIXTURE_NOW = new Date('2026-04-04T12:00:00Z');
const GROUP_ID = '11111111-1111-4111-8111-111111111111';
const PROPOSAL_ID = '22222222-2222-4222-8222-222222222222';
const GOVERNOR_ID = '33333333-3333-4333-8333-333333333333';

const BODY_HTML = `
  <h2>Upgrade governance participation</h2>
  <p>This proposal improves delegate participation by standardizing notifications, clearer timelines, and better context on proposal impact.</p>
  <p>It also introduces a more opinionated review flow so community members can understand the latest revision faster.</p>
  <ul>
    <li>Better summaries</li>
    <li>Cleaner revision history</li>
    <li>Lower friction for participation</li>
  </ul>
`;

const MOCK_PROPOSAL = {
  id: PROPOSAL_ID,
  name: 'Upgrade governance participation',
  url: 'https://forum.arbitrum.foundation/t/upgrade-governance-participation',
  discussionUrl:
    'https://forum.arbitrum.foundation/t/upgrade-governance-participation',
  body: BODY_HTML,
  choices: ['For', 'Abstain', 'Against'],
  quorum: 700000,
  proposalState: 'ACTIVE',
  markedSpam: false,
  createdAt: new Date('2026-03-28T10:00:00Z'),
  startAt: new Date('2026-03-29T10:00:00Z'),
  endAt: new Date('2026-04-08T10:00:00Z'),
  blockCreatedAt: 123456789,
  txid: null,
  metadata: {
    hiddenVote: false,
    scoresState: 'final',
    voteType: 'basic',
    quorumChoices: [0, 1],
  },
  daoId: 'dao-fixture',
  author: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
  governorId: GOVERNOR_ID,
  blockStartAt: null,
  blockEndAt: null,
} as const;

const MOCK_RESULTS = {
  proposal: MOCK_PROPOSAL,
  choices: ['For', 'Abstain', 'Against'],
  choiceColors: ['#69E000', '#FFCC33', '#FF4C42'],
  totalVotingPower: 1_100_000,
  quorum: 700000,
  quorumChoices: [0, 1],
  voteType: 'basic',
  votes: [
    {
      id: 'vote-1',
      proposalId: PROPOSAL_ID,
      voterAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
      votingPower: 650000,
      reason: 'This improves the delegate workflow without changing vote semantics.',
      createdAt: new Date('2026-03-30T09:00:00Z'),
      relativeVotingPower: 0.59,
      choice: [
        {
          choiceIndex: 0,
          weight: 100,
          text: 'For',
          color: '#69E000',
        },
      ],
    },
    {
      id: 'vote-2',
      proposalId: PROPOSAL_ID,
      voterAddress: '0x8ba1f109551BD432803012645Ac136ddd64DBA72',
      votingPower: 300000,
      reason: 'We should wait for a fuller communication plan before approving this.',
      createdAt: new Date('2026-03-31T15:30:00Z'),
      relativeVotingPower: 0.27,
      choice: [
        {
          choiceIndex: 2,
          weight: 100,
          text: 'Against',
          color: '#FF4C42',
        },
      ],
    },
    {
      id: 'vote-3',
      proposalId: PROPOSAL_ID,
      voterAddress: '0x5aEDA56215b167893e80B4fE645BA6d5Bab767DE',
      votingPower: 150000,
      reason: 'Neutral on the implementation details, but quorum should count this.',
      createdAt: new Date('2026-04-01T07:45:00Z'),
      relativeVotingPower: 0.14,
      choice: [
        {
          choiceIndex: 1,
          weight: 100,
          text: 'Abstain',
          color: '#FFCC33',
        },
      ],
    },
  ],
  timeSeriesData: [
    {
      timestamp: new Date('2026-03-30T09:00:00Z'),
      values: { 0: 300000 },
    },
    {
      timestamp: new Date('2026-03-31T15:30:00Z'),
      values: { 2: 300000 },
    },
    {
      timestamp: new Date('2026-04-01T07:45:00Z'),
      values: { 0: 350000, 1: 150000 },
    },
  ],
  finalResults: {
    0: 650000,
    1: 150000,
    2: 300000,
  },
  totalDelegatedVp: 1800000,
  hiddenVote: false,
  scoresState: 'final',
} as const;

const MOCK_RESULT_CARD = {
  ...MOCK_RESULTS,
  votes: undefined,
  timeSeriesData: undefined,
  voteSegments: {
    0: [
      { votingPower: 300000, isAggregated: true },
      { votingPower: 350000 },
    ],
    1: [{ votingPower: 150000 }],
    2: [{ votingPower: 300000 }],
  },
};

const MOCK_VOTES_WITH_VOTERS = [
  {
    id: 'vote-1',
    voterAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
    ens: 'vitalik.eth',
    discourseUsername: 'vitalik.eth',
    avatar: 'https://api.dicebear.com/9.x/pixel-art/png?seed=vitalik',
    latestVotingPower: 790000,
    votingPower: 650000,
  },
  {
    id: 'vote-2',
    voterAddress: '0x8ba1f109551BD432803012645Ac136ddd64DBA72',
    ens: 'delegate.alice',
    discourseUsername: null,
    avatar: 'https://api.dicebear.com/9.x/pixel-art/png?seed=alice',
    latestVotingPower: 420000,
    votingPower: 300000,
  },
  {
    id: 'vote-3',
    voterAddress: '0x5aEDA56215b167893e80B4fE645BA6d5Bab767DE',
    ens: null,
    discourseUsername: 'builder42',
    avatar: 'https://api.dicebear.com/9.x/pixel-art/png?seed=builder42',
    latestVotingPower: 190000,
    votingPower: 150000,
  },
] as const;

const MOCK_NON_VOTERS = {
  pid: PROPOSAL_ID,
  totalNumberOfNonVoters: 2,
  totalVotingPower: 520000,
  nonVoters: [
    {
      voterAddress: '0x1cbd3b2770909d4e10f157cabc84c7264073c9ec',
      ens: 'quiet.delegate',
      avatar: 'https://api.dicebear.com/9.x/pixel-art/png?seed=quiet',
      discourseUsername: null,
      currentVotingPower: 320000,
      votingPowerAtStart: 320000,
    },
    {
      voterAddress: '0x4bbeeb066ed09b7aed07bf39eee0460dfa261520',
      ens: null,
      avatar: 'https://api.dicebear.com/9.x/pixel-art/png?seed=absent',
      discourseUsername: 'absent-voter',
      currentVotingPower: 200000,
      votingPowerAtStart: 200000,
    },
  ],
} as const;

const SERIALIZED_RESULTS = superjson.serialize(MOCK_RESULTS);
const SERIALIZED_VOTES = superjson.serialize(MOCK_VOTES_WITH_VOTERS);

const MOCK_GROUP = {
  daoSlug: 'arbitrum',
  groupId: GROUP_ID,
  group: {
    id: GROUP_ID,
    name: 'Governance participation',
  },
  daoDiscourse: {
    discourseBaseUrl: 'https://forum.arbitrum.foundation',
  },
  proposals: [
    {
      id: PROPOSAL_ID,
      metadata: {
        voteType: 'basic',
      },
    },
  ],
  topics: [
    {
      id: 'topic-id',
      externalId: 42,
    },
  ],
} as const;

const MOCK_ACTIVE_FEED_DATA = {
  votes: [],
  posts: [],
  events: [
    {
      type: TimelineEventType.ResultOngoingBasicVote,
      content: 'Live vote',
      result: MOCK_RESULT_CARD as any,
    },
  ],
} as unknown as ComponentProps<typeof ActiveGroupItem>['feedData'];

const MOCK_GROUP_ITEMS: ComponentProps<typeof GroupList>['initialGroups'] = [
  {
    id: 'group-active',
    name: 'Governance participation',
    slug: GROUP_ID,
    authorName: 'vitalik.eth',
    authorAvatarUrl: 'https://api.dicebear.com/9.x/pixel-art/png?seed=vitalik',
    latestActivityAt: new Date('2026-04-03T10:00:00Z'),
    hasNewActivity: true,
    hasActiveProposal: true,
    topicsCount: 8,
    proposalsCount: 2,
    votesCount: 320,
    postsCount: 67,
    activeFeedData: MOCK_ACTIVE_FEED_DATA,
  },
  {
    id: 'group-inactive',
    name: 'Treasury reporting cadence',
    slug: 'group-inactive',
    authorName: 'alice.delegate',
    authorAvatarUrl: 'https://api.dicebear.com/9.x/pixel-art/png?seed=alice',
    latestActivityAt: new Date('2026-04-02T09:30:00Z'),
    hasNewActivity: false,
    hasActiveProposal: false,
    topicsCount: 4,
    proposalsCount: 1,
    votesCount: 25,
    postsCount: 18,
    activeFeedData: null,
  },
  {
    id: 'group-discussion',
    name: 'Protocol communications refresh',
    slug: 'group-discussion',
    authorName: 'builder42',
    authorAvatarUrl:
      'https://api.dicebear.com/9.x/pixel-art/png?seed=builder42',
    latestActivityAt: new Date('2026-04-01T08:15:00Z'),
    hasNewActivity: true,
    hasActiveProposal: false,
    topicsCount: 3,
    proposalsCount: 0,
    votesCount: 0,
    postsCount: 14,
    activeFeedData: null,
  },
];

const MOCK_BODY_VERSIONS = [
  {
    title: 'Initial Draft',
    content: BODY_HTML,
    author_name: 'vitalik.eth',
    author_picture: 'https://api.dicebear.com/9.x/pixel-art/png?seed=vitalik',
    createdAt: new Date('2026-03-28T10:00:00Z'),
    type: 'topic',
  },
  {
    title: 'Final Draft',
    content: BODY_HTML,
    author_name: 'vitalik.eth',
    author_picture: 'https://api.dicebear.com/9.x/pixel-art/png?seed=vitalik',
    createdAt: new Date('2026-03-31T14:00:00Z'),
    type: 'onchain',
  },
] as const;

const MOCK_POST_ITEM = {
  id: 'post-fixture',
  proposalId: PROPOSAL_ID,
  topicId: 42,
  postNumber: 6,
  userId: 1,
  daoDiscourseId: 'dao-discourse-fixture',
  externalId: 400,
  cooked: BODY_HTML,
  createdAt: new Date('2026-03-30T09:00:00Z'),
  updatedAt: new Date('2026-03-31T13:00:00Z'),
  deleted: false,
  reads: 418,
} as const;

const MOCK_POST_AUTHOR = {
  username: 'vitalik.eth',
  avatarTemplate: 'https://api.dicebear.com/9.x/pixel-art/png?seed=vitalik',
} as const;

const MOCK_PROFILE_SESSION = {
  user: {
    email: 'delegate@example.com',
    email_settings_new_discussions: true,
    email_settings_new_proposals: true,
    email_settings_ending_proposals: false,
  },
} as const;

const MOCK_TITLE_RESULTS = superjson.serialize(MOCK_RESULTS);
const MOCK_BODY_VERSIONS_NO_CONTENT = MOCK_BODY_VERSIONS.map(
  ({ content: _content, ...version }) => version
) as ComponentProps<typeof BodyHeader>['bodyVersionsNoContent'];
const MOCK_POSTED_REVISIONS_VERSIONS = MOCK_BODY_VERSIONS.map(
  ({ content: _content, ...version }) => version
) as ComponentProps<typeof PostedRevisions>['versions'];
const MOCK_MENU_BAR_VERSIONS = [...MOCK_BODY_VERSIONS] as ComponentProps<
  typeof MenuBar
>['bodyVersions'];

export function ArbitrumSummaryHeaderFixture() {
  return (
    <ArbitrumSummaryHeader
      activeGroupsCount={3}
      totalProposalsCount={28}
      totalTopicsCount={94}
      tokenPrice={1.24}
      totalVp={18_400_000}
      treasuryBalance={3_200_000_000}
    />
  );
}

export function UniswapSummaryHeaderFixture() {
  return (
    <UniswapSummaryHeader
      activeGroupsCount={2}
      totalProposalsCount={21}
      totalTopicsCount={76}
      tokenPrice={8.42}
      totalVp={11_800_000}
      treasuryBalance={2_140_000_000}
    />
  );
}

export function GroupsHeaderFixture() {
  return (
    <div className='w-full'>
      <ArbitrumActionBar hasNewActivity={true} signedIn={true} />
    </div>
  );
}

export function GroupListFixture() {
  return <GroupList initialGroups={MOCK_GROUP_ITEMS} signedIn={true} />;
}

export function MainPageFixture() {
  return (
    <div className='flex min-h-screen w-full justify-center bg-neutral-50 dark:bg-neutral-900'>
      <div className='w-full max-w-5xl px-4 py-6 md:px-8 md:py-10'>
        <ArbitrumSummaryHeaderFixture />
        <GroupsHeaderFixture />
        <GroupListFixture />
      </div>
    </div>
  );
}

export function ActiveGroupItemFixture() {
  return (
    <ActiveGroupItem
      group={MOCK_GROUP_ITEMS[0]}
      feedData={MOCK_GROUP_ITEMS[0].activeFeedData as any}
      currentTime={FIXTURE_NOW}
    />
  );
}

export function InactiveGroupItemFixture() {
  return (
    <InactiveGroupItem
      group={MOCK_GROUP_ITEMS[1]}
      currentTime={FIXTURE_NOW}
    />
  );
}

export function DiscussionGroupItemFixture() {
  return (
    <DiscussionGroupItem
      group={MOCK_GROUP_ITEMS[2]}
      currentTime={FIXTURE_NOW}
    />
  );
}

export function BodyHeaderFixture() {
  return (
    <BodyHeader
      groupName='Governance participation'
      originalAuthorName='vitalik.eth'
      originalAuthorPicture='https://api.dicebear.com/9.x/pixel-art/png?seed=vitalik'
      firstBodyVersionCreatedAt={MOCK_BODY_VERSIONS[0].createdAt}
      bodyVersionsNoContent={MOCK_BODY_VERSIONS_NO_CONTENT}
    />
  );
}

export function InitiallyPostedFixture() {
  return (
    <div className='inline-block w-fit'>
      <InitiallyPosted createdAt={MOCK_BODY_VERSIONS[0].createdAt} />
    </div>
  );
}

export function PostedRevisionsFixture() {
  return (
    <div className='inline-block w-fit'>
      <PostedRevisions versions={MOCK_POSTED_REVISIONS_VERSIONS} />
    </div>
  );
}

export function BodyFixture() {
  return <BodyContent processedContent={BODY_HTML} />;
}

export function MenuBarFullFixture() {
  return (
    <MenuBar
      bodyVersions={MOCK_MENU_BAR_VERSIONS}
      currentVersion={1}
      diff={false}
    />
  );
}

export function MenuBarBodyFixture() {
  return (
    <BodyViewBar
      bodyVersions={MOCK_MENU_BAR_VERSIONS}
      currentVersion={1}
      view={ViewEnum.BODY}
      setView={() => {}}
      diff={false}
      includesProposals={true}
    />
  );
}

export function MenuBarCommentsFixture() {
  return (
    <CommentsViewBar
      view={ViewEnum.COMMENTS}
      setView={() => {}}
      includesProposals={true}
    />
  );
}

export function PostItemFixture() {
  return (
    <div className='w-full scroll-mt-36 py-4'>
      <PostContent
        author={MOCK_POST_AUTHOR as any}
        ens='vitalik.eth'
        relativeCreateTime='5 days ago'
        relativeUpdateTime='4 days ago'
        updatedAt={MOCK_POST_ITEM.updatedAt}
        likesCount={42}
        processedContent={BODY_HTML}
        contentLength={BODY_HTML.length}
        item={MOCK_POST_ITEM as any}
        currentVotingPower={790000}
        discourseBaseUrl='https://forum.arbitrum.foundation'
      />
    </div>
  );
}

export function VoteItemFixture() {
  return (
    <VoteItem
      item={MOCK_RESULTS.votes[0] as any}
      voteWithVoter={MOCK_VOTES_WITH_VOTERS[0] as any}
      group={MOCK_GROUP as any}
    />
  );
}

export function AggregateVoteItemFixture() {
  return (
    <AggregateVoteItem
      item={{
        ...MOCK_RESULTS.votes[0],
        id: 'aggregate-vote-fixture',
        aggregate: true,
        votingPower: 990000,
      } as any}
      group={MOCK_GROUP as any}
    />
  );
}

export function FeedFixture() {
  return (
    <div className='flex w-full flex-col'>
      <div className='border-b border-neutral-200 py-4 dark:border-neutral-800'>
        <div className='flex w-full flex-col'>
          <PostItemFixture />
        </div>
      </div>
      <div className='border-b border-neutral-200 dark:border-neutral-800'>
        <div className='flex w-full flex-col'>
          <VoteItemFixture />
        </div>
      </div>
      <div className='border-b border-neutral-200 dark:border-neutral-800'>
        <div className='flex w-full flex-col'>
          <AggregateVoteItemFixture />
        </div>
      </div>
    </div>
  );
}

export function GroupPageFixture() {
  return (
    <div className='flex min-h-screen w-full justify-center bg-neutral-50 dark:bg-neutral-900'>
      <div className='w-full max-w-5xl px-4 py-6 md:px-8 md:py-10'>
        <div className='flex w-full flex-col gap-6'>
          <BodyHeaderFixture />
          <BodyFixture />
          <MenuBarFullFixture />
          <FeedFixture />
        </div>
      </div>
    </div>
  );
}

export function ResultsHeaderFixture() {
  return (
    <GroupHeaderBar
      groupId={GROUP_ID}
      withBack={true}
      originalAuthorName='vitalik.eth'
      originalAuthorPicture='https://api.dicebear.com/9.x/pixel-art/png?seed=vitalik'
      groupName='Governance participation'
      position='static'
    />
  );
}

export function ResultsTitleFixture() {
  return (
    <ResultsTitle
      results={MOCK_TITLE_RESULTS}
      onChain={true}
      publisher={{
        ens: 'vitalik.eth',
        address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
      } as any}
      governor={{
        id: GOVERNOR_ID,
        daoId: 'dao-fixture',
        name: 'Arbitrum Core',
        portalUrl: 'https://www.tally.xyz/gov/arbitrum',
      }}
    />
  );
}

export function ResultsListFixture() {
  return (
    <div className='inline-block w-fit'>
      <ResultsList results={SERIALIZED_RESULTS} onchain={true} />
    </div>
  );
}

export function ResultsListBarsFixture() {
  return (
    <div className='inline-block w-fit'>
      <ResultsListBars results={SERIALIZED_RESULTS} onchain={true} />
    </div>
  );
}

export function ResultsChartFixture() {
  return <ResultsChart results={SERIALIZED_RESULTS} />;
}

export function ResultsTableFixture() {
  return <ResultsTable results={SERIALIZED_RESULTS} votes={SERIALIZED_VOTES} />;
}

export function NonVotersTableFixture() {
  return (
    <NonVotersTable nonVoters={MOCK_NON_VOTERS as any} defaultExpanded={true} />
  );
}

export function TimelineFixture() {
  return (
    <div className='hidden w-44 sm:block'>
      <div className='relative h-[calc(100vh-96px)] w-full'>
        <div className='rounded-xs absolute top-2 flex h-8 w-8 items-center justify-center border-2 border-neutral-300 bg-neutral-100 dark:border-neutral-600 dark:bg-neutral-800'>
          <TimelineEventIcon
            className='fill-neutral-800 dark:fill-neutral-350'
            width={24}
            height={24}
            alt='Timeline event'
          />
        </div>

        <div className='absolute bottom-5 left-[15px] top-5 z-10 w-0.5 bg-neutral-800 dark:bg-neutral-350' />

        <div className='rounded-xs absolute bottom-1 flex h-8 w-8 items-center justify-center border-2 border-neutral-300 bg-neutral-100 dark:border-neutral-600 dark:bg-neutral-800'>
          <TimelineEventIcon
            className='fill-neutral-800 dark:fill-neutral-350'
            width={24}
            height={24}
            alt='Timeline event'
          />
        </div>

        <div className='flex h-full flex-col justify-between'>
          <div className='relative flex w-full items-center justify-start'>
            <CommentsVolume />
          </div>
          <div className='relative flex w-full items-center justify-start'>
            <Result
              eventType={TimelineEventType.ResultOngoingBasicVote}
              content='Live vote'
              timestamp={FIXTURE_NOW}
              proposal={MOCK_PROPOSAL as any}
              resultNumber={1}
              selectedResult={1}
              daoSlug='arbitrum'
              groupId={GROUP_ID}
              eventIndex={1}
              last={false}
            />
          </div>
          <div className='relative flex w-full items-center justify-start'>
            <VotesVolume />
          </div>
          <div className='relative flex w-full items-center justify-start'>
            <Basic />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ResultsFixture() {
  return (
    <div className='flex w-full flex-col gap-2 sm:flex-row'>
      <div className='flex w-full flex-col gap-8 sm:gap-2'>
        <div className='hidden lg:block'>
          <ResultsTitleFixture />
        </div>
        <div className='flex justify-center sm:hidden'>
          <ResultsListFixture />
        </div>
        <div className='flex justify-center sm:hidden'>
          <ResultsListBarsFixture />
        </div>
        <ResultsChartFixture />
        <div className='flex flex-col'>
          <NonVotersTableFixture />
          <ResultsTableFixture />
        </div>
      </div>
      <div className='hidden sm:block'>
        <ResultsListFixture />
        <ResultsListBarsFixture />
      </div>
    </div>
  );
}

export function ResultsPageFixture() {
  return (
    <div className='flex min-h-screen w-full flex-row'>
      <ResultsHeaderFixture />
      <TimelineFixture />
      <div className='flex w-full grow -translate-x-[1px] py-2 sm:-translate-y-2 sm:py-28'>
        <div className='h-full w-full pl-2 pr-2 sm:pl-0 sm:pr-4'>
          <div className='rounded-r-xs flex h-full min-h-[calc(100vh-114px)] w-full flex-col border border-neutral-800 bg-white p-6 dark:border-neutral-650 dark:bg-neutral-950'>
            <ResultsFixture />
          </div>
        </div>
      </div>
    </div>
  );
}

export function NavShellFixture({
  daoSlug = 'arbitrum',
}: {
  daoSlug?: string;
}) {
  return (
    <div className='w-full md:w-20 md:min-h-screen'>
      <NavBarContent daoSlug={daoSlug} initialTheme='dark' layout='static' />
    </div>
  );
}

export function ModeToggleFixture() {
  return (
    <div className='inline-block w-fit'>
      <ModeToggle initialTheme='dark' />
    </div>
  );
}

export function ProfilePageFixture() {
  return (
    <div className='flex min-h-screen w-full justify-center bg-neutral-50 dark:bg-neutral-900'>
      <div className='w-full max-w-5xl px-4 py-6 md:px-8 md:py-10'>
        <main className='w-full py-4 sm:py-6 md:py-10'>
          <div className='mb-8 text-center'>
            <h1 className='mb-2 text-3xl font-bold text-neutral-800 dark:text-neutral-100'>
              Welcome back,
            </h1>
            <p className='max-w-full truncate px-2 text-lg font-medium text-neutral-600 dark:text-neutral-400'>
              {MOCK_PROFILE_SESSION.user.email}
            </p>
          </div>

          <div id='notifications' className='mb-8'>
            <UserSettings session={MOCK_PROFILE_SESSION as any} />
          </div>
          <div id='account' className='mb-8'>
            <AccountManagement session={MOCK_PROFILE_SESSION as any} />
          </div>
          <SignOutButton />
        </main>
      </div>
    </div>
  );
}

export function OnboardingPageFixture() {
  return <EmailPreferences />;
}

export function MappingPageFixture() {
  return (
    <div className='container mx-auto p-6'>
      <PageHeader
        title='Proposal Group Management for Arbitrum DAO'
        description='Create and manage proposal groups to better organize and map proposals within Arbitrum DAO.'
        actionLinks={[
          {
            href: '/mapping/delegates',
            label: 'Delegate Mapping',
          },
        ]}
      >
        <MappingButton type='button' variant='primary' fullWidth>
          Create Group
        </MappingButton>
      </PageHeader>

      <div className='mb-8'>
        <h2 className='mb-4 text-xl font-semibold text-neutral-800 dark:text-neutral-200'>
          Ungrouped Proposals
        </h2>
        <MappingTable headers={['Type', 'Indexer', 'Name']}>
          <MappingTableRow>
            <MappingTableCell>
              <Badge variant='blue'>Proposal</Badge>
            </MappingTableCell>
            <MappingTableCell>
              <Badge variant='green'>ARBITRUM_CORE</Badge>
            </MappingTableCell>
            <MappingTableCell>
              Upgrade governance participation
            </MappingTableCell>
          </MappingTableRow>
          <MappingTableRow>
            <MappingTableCell>
              <Badge variant='blue'>Proposal</Badge>
            </MappingTableCell>
            <MappingTableCell>
              <Badge variant='purple'>SNAPSHOT</Badge>
            </MappingTableCell>
            <MappingTableCell>Delegate incentive refresh</MappingTableCell>
          </MappingTableRow>
        </MappingTable>
      </div>

      <section>
        <MappingTable headers={['Group', 'Items', 'Updated']}>
          <MappingTableRow>
            <MappingTableCell>Governance participation</MappingTableCell>
            <MappingTableCell>2 proposals, 1 discussion</MappingTableCell>
            <MappingTableCell>Updated today</MappingTableCell>
          </MappingTableRow>
          <MappingTableRow>
            <MappingTableCell>Treasury reporting</MappingTableCell>
            <MappingTableCell>1 proposal</MappingTableCell>
            <MappingTableCell>Updated yesterday</MappingTableCell>
          </MappingTableRow>
        </MappingTable>
      </section>
    </div>
  );
}

export function DelegatesPageFixture() {
  return (
    <div className='container mx-auto p-6'>
      <PageHeader
        title='Delegate Mappings for Arbitrum DAO'
        description='Manage delegate mappings for Discourse users and voters in Arbitrum DAO.'
        actionLinks={[
          {
            href: '/mapping',
            label: 'Proposal Mapping',
          },
        ]}
      >
        <MappingButton type='button' variant='primary' fullWidth>
          Create Delegate
        </MappingButton>
      </PageHeader>

      <MappingTable
        headers={[
          'Delegate ID',
          'Discourse User Mapping',
          'Voter Mapping',
          'Actions',
        ]}
      >
        <MappingTableRow>
          <MappingTableCell>delegate-001</MappingTableCell>
          <MappingTableCell>vitalik.eth</MappingTableCell>
          <MappingTableCell>0x742d...8f44e</MappingTableCell>
          <MappingTableCell>Review links</MappingTableCell>
        </MappingTableRow>
        <MappingTableRow>
          <MappingTableCell>delegate-002</MappingTableCell>
          <MappingTableCell>builder42</MappingTableCell>
          <MappingTableCell>0x8ba1...dBA72</MappingTableCell>
          <MappingTableCell>Review links</MappingTableCell>
        </MappingTableRow>
      </MappingTable>
    </div>
  );
}
