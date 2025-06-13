import type { Meta, StoryObj } from '@storybook/nextjs';
import { GroupList } from './group-list';
import { SkeletonGroupListWithControls } from '../../../components/ui/skeleton';

const meta: Meta<typeof GroupList> = {
  title: 'DAO/Group List/GroupList',
  component: GroupList,
  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'light',
    },
  },
  args: {
    signedIn: false,
  },
  argTypes: {
    signedIn: {
      control: 'boolean',
    },
  },
};

export default meta;
type Story = StoryObj<typeof GroupList>;

// Sample group data combining active, inactive, and discussion items
const sampleGroups = [
  // Active proposals (first 3)
  {
    id: 'a639133f-3324-4d16-9a3f-1c60af79065b',
    name: "[Non-Constitutional] Let's improve our governance forum with three proposals.app feature integrations",
    slug: 'a639133f-3324-4d16-9a3f-1c60af79065b',
    authorName: 'paulofonseca',
    authorAvatarUrl:
      'https://yyz1.discourse-cdn.com/flex029/user_avatar/forum.arbitrum.foundation/paulofonseca/96/13858_2.png',
    latestActivityAt: new Date('2025-06-13T15:15:30.398Z'),
    hasNewActivity: false,
    hasActiveProposal: true,
    topicsCount: 1,
    proposalsCount: 1,
    votesCount: 1233,
    postsCount: 45,
    activeFeedData: {
      votes: [],
      posts: [],
      events: [],
    },
  },
  {
    id: 'b749244f-4435-5e27-ab4f-2c70af89076c',
    name: '[Constitutional] Treasury Management Framework Update',
    slug: 'b749244f-4435-5e27-ab4f-2c70af89076c',
    authorName: 'Entropy',
    authorAvatarUrl:
      'https://yyz1.discourse-cdn.com/flex029/user_avatar/forum.arbitrum.foundation/entropy/96/9769_2.png',
    latestActivityAt: new Date('2025-06-13T12:30:15.123Z'),
    hasNewActivity: true,
    hasActiveProposal: true,
    topicsCount: 1,
    proposalsCount: 1,
    votesCount: 5432,
    postsCount: 127,
    activeFeedData: {
      votes: [],
      posts: [],
      events: [],
    },
  },
  {
    id: 'c859355f-5546-6f38-bc5f-3d81bf90187d',
    name: '[Non-Constitutional] Arbitrum Research & Development Collective (ARDC) Proposal',
    slug: 'c859355f-5546-6f38-bc5f-3d81bf90187d',
    authorName: 'BlockworksResearch',
    authorAvatarUrl:
      'https://yyz1.discourse-cdn.com/flex029/user_avatar/forum.arbitrum.foundation/blockworksresearch/96/8765_2.png',
    latestActivityAt: new Date('2025-06-13T09:45:22.456Z'),
    hasNewActivity: true,
    hasActiveProposal: true,
    topicsCount: 1,
    proposalsCount: 1,
    votesCount: 3456,
    postsCount: 89,
    activeFeedData: {
      votes: [],
      posts: [],
      events: [],
    },
  },
  // Inactive proposals (completed)
  {
    id: '6a670117-e537-4e3c-88c8-51f023912e76',
    name: '[Constitutional] AIP: Constitutional Quorum Threshold Reduction',
    slug: '6a670117-e537-4e3c-88c8-51f023912e76',
    authorName: 'Arbitrum',
    authorAvatarUrl:
      'https://yyz1.discourse-cdn.com/flex029/user_avatar/forum.arbitrum.foundation/arbitrum/96/2693_2.png',
    latestActivityAt: new Date('2025-06-11T20:25:17.370Z'),
    hasNewActivity: false,
    hasActiveProposal: false,
    topicsCount: 1,
    proposalsCount: 1,
    votesCount: 2917,
    postsCount: 75,
    activeFeedData: null,
  },
  {
    id: 'd969466f-6657-7g49-cd6f-4e92cg01298e',
    name: '[Non-Constitutional] Grant Program Enhancement',
    slug: 'd969466f-6657-7g49-cd6f-4e92cg01298e',
    authorName: 'GrantsCommittee',
    authorAvatarUrl:
      'https://yyz1.discourse-cdn.com/flex029/user_avatar/forum.arbitrum.foundation/grantscommittee/96/5432_2.png',
    latestActivityAt: new Date('2025-06-10T14:20:45.789Z'),
    hasNewActivity: false,
    hasActiveProposal: false,
    topicsCount: 1,
    proposalsCount: 1,
    votesCount: 1876,
    postsCount: 52,
    activeFeedData: null,
  },
  // Discussion items
  {
    id: '5285fbaf-82c2-4caa-913d-8353057a3e6e',
    name: 'Remove "Trending Delegates" from tally.xyz',
    slug: '5285fbaf-82c2-4caa-913d-8353057a3e6e',
    authorName: 'CryptoNick',
    authorAvatarUrl:
      'https://yyz1.discourse-cdn.com/flex029/user_avatar/forum.arbitrum.foundation/cryptonick/96/1204_2.png',
    latestActivityAt: new Date('2023-04-09T04:00:12.398Z'),
    hasNewActivity: false,
    hasActiveProposal: false,
    topicsCount: 1,
    proposalsCount: 0,
    votesCount: 0,
    postsCount: 17,
    activeFeedData: null,
  },
  {
    id: 'e079577f-7768-8h5a-de7f-5f03dh12409f',
    name: 'Community Call: Q2 2025 Governance Review',
    slug: 'e079577f-7768-8h5a-de7f-5f03dh12409f',
    authorName: 'DAOStewards',
    authorAvatarUrl:
      'https://yyz1.discourse-cdn.com/flex029/user_avatar/forum.arbitrum.foundation/daostewards/96/3456_2.png',
    latestActivityAt: new Date('2025-06-12T16:30:00.000Z'),
    hasNewActivity: true,
    hasActiveProposal: false,
    topicsCount: 1,
    proposalsCount: 0,
    votesCount: 0,
    postsCount: 23,
    activeFeedData: null,
  },
  {
    id: 'f189688f-8879-9i6b-ef8f-6g14ei23510g',
    name: 'Technical Discussion: L2 Security Improvements',
    slug: 'f189688f-8879-9i6b-ef8f-6g14ei23510g',
    authorName: 'SecurityDAO',
    authorAvatarUrl:
      'https://yyz1.discourse-cdn.com/flex029/user_avatar/forum.arbitrum.foundation/securitydao/96/7890_2.png',
    latestActivityAt: new Date('2025-06-09T11:15:30.456Z'),
    hasNewActivity: false,
    hasActiveProposal: false,
    topicsCount: 1,
    proposalsCount: 0,
    votesCount: 12,
    postsCount: 34,
    activeFeedData: null,
  },
];

export const Default: Story = {
  args: {
    initialGroups: sampleGroups,
    signedIn: false,
  },
};

export const WithSignedInUser: Story = {
  args: {
    initialGroups: sampleGroups,
    signedIn: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Shows the group list with "Unread" filter available for signed-in users',
      },
    },
  },
};

export const WithUnreadItems: Story = {
  args: {
    initialGroups: sampleGroups.map((group, index) => ({
      ...group,
      hasNewActivity: index < 4, // First 4 items have new activity
    })),
    signedIn: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows multiple items with unread activity indicators',
      },
    },
  },
};

export const EmptyList: Story = {
  args: {
    initialGroups: [],
    signedIn: false,
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows the empty state when no groups are available',
      },
    },
  },
};

export const ActiveOnlyFilter: Story = {
  args: {
    initialGroups: sampleGroups,
    signedIn: false,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Shows how the list looks with active proposals only (user would filter manually)',
      },
    },
  },
};

export const LongTitles: Story = {
  args: {
    initialGroups: [
      {
        ...sampleGroups[0],
        name: 'This is an extremely long proposal title that demonstrates how the group list component handles text wrapping and truncation when dealing with verbose proposal names that exceed normal length expectations and continue for multiple lines of text',
      },
      {
        ...sampleGroups[1],
        name: 'Another very lengthy proposal title that showcases the responsive design capabilities of the group list when titles are significantly longer than the typical governance proposal naming conventions',
      },
      ...sampleGroups.slice(2, 4),
    ],
    signedIn: false,
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows how the group list handles very long proposal titles',
      },
    },
  },
};

export const Loading = {
  render: () => <SkeletonGroupListWithControls />,
  parameters: {
    docs: {
      description: {
        story:
          'Loading skeleton state with search bar, filter controls, and a realistic mix of active, inactive, and discussion item skeletons',
      },
    },
  },
};

export const LoadingSignedIn = {
  render: () => <SkeletonGroupListWithControls />,
  parameters: {
    docs: {
      description: {
        story:
          'Loading skeleton state for signed-in users, showing the unread filter option',
      },
    },
  },
};
