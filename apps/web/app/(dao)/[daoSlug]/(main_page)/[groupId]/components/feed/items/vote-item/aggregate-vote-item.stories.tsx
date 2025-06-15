import type { Meta, StoryObj } from '@storybook/nextjs';
import { AggregateVoteItem } from './aggregate-vote-item';
import { SkeletonAggregateVoteItem } from '@/app/components/ui/skeleton';
import {
  mockAggregateVote,
  mockGroup,
  mockGroupWithWeightedVoting,
} from '@/.storybook/mock-data';

const meta: Meta<typeof AggregateVoteItem> = {
  title: 'DAO/Feed/Items/AggregateVoteItem',
  component: AggregateVoteItem,
  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'light',
    },
    docs: {
      description: {
        component:
          'Displays aggregated votes from multiple voters with reduced opacity to distinguish from individual votes. Shows combined voting power and choice display.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof AggregateVoteItem>;

export const Default: Story = {
  args: {
    item: mockAggregateVote,
    group: mockGroup,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Standard aggregated vote showing "Multiple voters" placeholder with combined voting power.',
      },
    },
  },
};

export const HighVotingPower: Story = {
  args: {
    item: {
      ...mockAggregateVote,
      votingPower: 25750000,
      relativeVotingPower: 0.98,
    },
    group: mockGroup,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Aggregated vote with very high combined voting power showing number formatting.',
      },
    },
  },
};

export const AgainstVote: Story = {
  args: {
    item: {
      ...mockAggregateVote,
      choice: [
        { choiceIndex: 1, text: 'Against', weight: 100, color: '#FF4C42' },
      ],
      votingPower: 5250000,
    },
    group: mockGroup,
  },
  parameters: {
    docs: {
      description: {
        story: 'Aggregated "Against" votes with red color indication.',
      },
    },
  },
};

export const AbstainVote: Story = {
  args: {
    item: {
      ...mockAggregateVote,
      choice: [
        { choiceIndex: 2, text: 'Abstain', weight: 100, color: '#FFCC33' },
      ],
      votingPower: 1850000,
    },
    group: mockGroup,
  },
  parameters: {
    docs: {
      description: {
        story: 'Aggregated "Abstain" votes with yellow color indication.',
      },
    },
  },
};

export const WeightedAggregate: Story = {
  args: {
    item: {
      ...mockAggregateVote,
      choice: [
        { choiceIndex: 0, text: 'Option A', weight: 45, color: '#69E000' },
        { choiceIndex: 1, text: 'Option B', weight: 35, color: '#FF4C42' },
        { choiceIndex: 2, text: 'Option C', weight: 20, color: '#FFCC33' },
      ],
      votingPower: 8500000,
    },
    group: mockGroupWithWeightedVoting,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Aggregated weighted votes showing combined percentages across multiple options.',
      },
    },
  },
};

export const ApprovalAggregate: Story = {
  args: {
    item: {
      ...mockAggregateVote,
      choice: [
        { choiceIndex: 0, text: 'Alice', weight: 100, color: '#69E000' },
        { choiceIndex: 1, text: 'Bob', weight: 100, color: '#3B82F6' },
        { choiceIndex: 2, text: 'Charlie', weight: 100, color: '#8B5CF6' },
        { choiceIndex: 3, text: 'Diana', weight: 100, color: '#EC4899' },
      ],
      votingPower: 12750000,
    },
    group: mockGroup,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Aggregated approval votes supporting multiple candidates or options.',
      },
    },
  },
};

export const RecentAggregate: Story = {
  args: {
    item: {
      ...mockAggregateVote,
      createdAt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
    },
    group: mockGroup,
  },
  parameters: {
    docs: {
      description: {
        story: 'Recently aggregated votes showing relative time formatting.',
      },
    },
  },
};

export const LowVotingPower: Story = {
  args: {
    item: {
      ...mockAggregateVote,
      votingPower: 125000,
      relativeVotingPower: 0.08,
    },
    group: mockGroup,
  },
  parameters: {
    docs: {
      description: {
        story: 'Aggregated votes with relatively low combined voting power.',
      },
    },
  },
};

export const SingleChoiceAggregate: Story = {
  args: {
    item: {
      ...mockAggregateVote,
      choice: [{ choiceIndex: 0, text: 'Yes', weight: 100, color: '#69E000' }],
      votingPower: 3750000,
    },
    group: mockGroup,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Aggregated votes for a simple yes/no proposal showing single choice.',
      },
    },
  },
};

export const Loading: StoryObj<typeof SkeletonAggregateVoteItem> = {
  render: () => <SkeletonAggregateVoteItem />,
  parameters: {
    docs: {
      description: {
        story: 'Loading skeleton state for the AggregateVoteItem component.',
      },
    },
  },
};
