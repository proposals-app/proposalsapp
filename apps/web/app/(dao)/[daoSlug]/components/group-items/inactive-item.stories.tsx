import type { Meta, StoryObj } from '@storybook/nextjs';
import { InactiveGroupItem } from './inactive-item';
import { SkeletonInactiveGroupItem } from '../../../../components/ui/skeleton';

const meta: Meta<typeof InactiveGroupItem> = {
  title: 'DAO/Group Items/InactiveGroupItem',
  component: InactiveGroupItem,
  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'light',
    },
  },
  args: {
    currentTime: new Date('2025-06-13T19:47:50.627Z'),
  },
  argTypes: {
    currentTime: {
      control: 'date',
    },
  },
};

export default meta;
type Story = StoryObj<typeof InactiveGroupItem>;

export const Default: Story = {
  args: {
    group: {
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
    },
  },
};

export const WithNewActivity: Story = {
  args: {
    ...Default.args,
    group: {
      ...Default.args!.group!,
      hasNewActivity: true,
    },
  },
};

export const RecentActivity: Story = {
  args: {
    ...Default.args,
    group: {
      ...Default.args!.group!,
      name: 'Recent Treasury Management Discussion',
      latestActivityAt: new Date('2025-06-13T18:30:00.000Z'),
      hasNewActivity: true,
    },
  },
};

export const HighEngagement: Story = {
  args: {
    ...Default.args,
    group: {
      ...Default.args!.group!,
      name: 'Popular Completed Proposal',
      votesCount: 8765,
      postsCount: 156,
      hasNewActivity: false,
    },
  },
};

export const LowEngagement: Story = {
  args: {
    ...Default.args,
    group: {
      ...Default.args!.group!,
      name: 'Minor Technical Update',
      votesCount: 23,
      postsCount: 5,
      hasNewActivity: false,
    },
  },
};

export const VotesOnly: Story = {
  args: {
    ...Default.args,
    group: {
      ...Default.args!.group!,
      name: 'Proposal with Votes but No Comments',
      votesCount: 1234,
      postsCount: 0,
      hasNewActivity: false,
    },
  },
};

export const CommentsOnly: Story = {
  args: {
    ...Default.args,
    group: {
      ...Default.args!.group!,
      name: 'Discussion with Comments but No Votes',
      votesCount: 0,
      postsCount: 42,
      hasNewActivity: false,
    },
  },
};

export const NoActivity: Story = {
  args: {
    ...Default.args,
    group: {
      ...Default.args!.group!,
      name: 'Proposal with No Engagement',
      votesCount: 0,
      postsCount: 0,
      hasNewActivity: false,
    },
  },
};

export const LongTitle: Story = {
  args: {
    ...Default.args,
    group: {
      ...Default.args!.group!,
      name: 'This is an extremely long proposal title that demonstrates how the inactive group item component handles text wrapping and truncation when dealing with verbose proposal names that exceed normal length expectations',
    },
  },
};

export const OldActivity: Story = {
  args: {
    ...Default.args,
    group: {
      ...Default.args!.group!,
      name: 'Old Archived Proposal',
      latestActivityAt: new Date('2024-01-15T10:00:00.000Z'),
      hasNewActivity: false,
    },
  },
};

export const Loading = {
  render: () => <SkeletonInactiveGroupItem />,
  parameters: {
    docs: {
      description: {
        story: 'Loading skeleton for inactive group items',
      },
    },
  },
};
