import type { Meta, StoryObj } from '@storybook/nextjs';
import { DiscussionGroupItem } from './discussion-item';
import { SkeletonDiscussionGroupItem } from '../../../../components/ui/skeleton';

const meta: Meta<typeof DiscussionGroupItem> = {
  title: 'DAO/Group Items/DiscussionGroupItem',
  component: DiscussionGroupItem,
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
type Story = StoryObj<typeof DiscussionGroupItem>;

export const Default: Story = {
  args: {
    group: {
      id: '5285fbaf-82c2-4caa-913d-8353057a3e6e',
      name: 'Remove “Trending Delegates” from tally.xyz',
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

export const RecentDiscussion: Story = {
  args: {
    ...Default.args,
    group: {
      ...Default.args!.group!,
      name: 'Active Community Discussion on Token Economics',
      latestActivityAt: new Date('2025-06-13T18:45:00.000Z'),
      hasNewActivity: true,
      postsCount: 34,
    },
  },
};

export const HighEngagement: Story = {
  args: {
    ...Default.args,
    group: {
      ...Default.args!.group!,
      name: 'Popular Discussion Thread',
      postsCount: 89,
      hasNewActivity: true,
    },
  },
};

export const LowEngagement: Story = {
  args: {
    ...Default.args,
    group: {
      ...Default.args!.group!,
      name: 'Minor Technical Question',
      postsCount: 3,
      hasNewActivity: false,
    },
  },
};

export const NoActivity: Story = {
  args: {
    ...Default.args,
    group: {
      ...Default.args!.group!,
      name: 'Discussion with No Engagement',
      votesCount: 0,
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
      name: 'Discussion Thread with Only Comments',
      votesCount: 0,
      postsCount: 25,
      hasNewActivity: false,
    },
  },
};

export const VotesOnly: Story = {
  args: {
    ...Default.args,
    group: {
      ...Default.args!.group!,
      name: 'Straw Poll Discussion',
      votesCount: 156,
      postsCount: 0,
      hasNewActivity: false,
    },
  },
};

export const VotesAndComments: Story = {
  args: {
    ...Default.args,
    group: {
      ...Default.args!.group!,
      name: 'Engaged Discussion with Both Votes and Comments',
      votesCount: 67,
      postsCount: 43,
      hasNewActivity: true,
    },
  },
};

export const LongTitle: Story = {
  args: {
    ...Default.args,
    group: {
      ...Default.args!.group!,
      name: 'This is an extremely long discussion title that demonstrates how the discussion group item component handles text wrapping and truncation when dealing with verbose discussion names that exceed normal length expectations for forum topics',
    },
  },
};

export const OldDiscussion: Story = {
  args: {
    ...Default.args,
    group: {
      ...Default.args!.group!,
      name: 'Archived Discussion from Last Year',
      latestActivityAt: new Date('2024-03-15T14:22:00.000Z'),
      hasNewActivity: false,
      postsCount: 12,
    },
  },
};

export const Loading = {
  render: () => <SkeletonDiscussionGroupItem />,
  parameters: {
    docs: {
      description: {
        story: 'Loading skeleton for discussion group items',
      },
    },
  },
};
