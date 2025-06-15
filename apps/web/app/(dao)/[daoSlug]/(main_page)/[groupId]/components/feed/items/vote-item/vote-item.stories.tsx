import type { Meta, StoryObj } from '@storybook/nextjs';
import { VoteItem } from './vote-item';
import { SkeletonVoteItemFeed } from '@/app/components/ui/skeleton';
import {
  mockVoteFor,
  mockVoteAgainst,
  mockVoteAbstain,
  mockWeightedVote,
  mockApprovalVote,
  mockVoterAuthor,
  mockGroup,
  mockGroupWithWeightedVoting,
} from '@/.storybook/mock-data';

const meta: Meta<typeof VoteItem> = {
  title: 'DAO/Feed/Items/VoteItem',
  component: VoteItem,
  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'light',
    },
    docs: {
      description: {
        component:
          'Displays individual vote entries in the feed with colored choice bars, voter information, voting power, and vote reasoning.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof VoteItem>;

export const VoteFor: Story = {
  args: {
    item: mockVoteFor,
    voteWithVoter: mockVoterAuthor,
    group: mockGroup,
  },
  parameters: {
    docs: {
      description: {
        story:
          'A "For" vote with green color bar, showing voter information and reasoning.',
      },
    },
  },
};

export const VoteAgainst: Story = {
  args: {
    item: mockVoteAgainst,
    voteWithVoter: {
      ...mockVoterAuthor,
      voterAddress: '0x8ba1f109551bD432803012645Hac136c5B8C67C8',
      ens: 'delegate.eth',
      latestVotingPower: 850000,
      votingPower: 850000,
    },
    group: mockGroup,
  },
  parameters: {
    docs: {
      description: {
        story:
          'An "Against" vote with red color bar and reasoning for opposition.',
      },
    },
  },
};

export const VoteAbstain: Story = {
  args: {
    item: mockVoteAbstain,
    voteWithVoter: {
      ...mockVoterAuthor,
      voterAddress: '0x3f5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE',
      ens: 'neutral.eth',
      latestVotingPower: 425000,
      votingPower: 425000,
    },
    group: mockGroup,
  },
  parameters: {
    docs: {
      description: {
        story:
          'An "Abstain" vote with yellow color bar, indicating neutrality.',
      },
    },
  },
};

export const WeightedVote: Story = {
  args: {
    item: mockWeightedVote,
    voteWithVoter: {
      ...mockVoterAuthor,
      latestVotingPower: 2100000,
      votingPower: 2100000,
    },
    group: mockGroupWithWeightedVoting,
  },
  parameters: {
    docs: {
      description: {
        story:
          'A weighted vote showing multiple choices with different percentages and color bars.',
      },
    },
  },
};

export const ApprovalVote: Story = {
  args: {
    item: mockApprovalVote,
    voteWithVoter: {
      ...mockVoterAuthor,
      latestVotingPower: 1750000,
      votingPower: 1750000,
    },
    group: mockGroup,
  },
  parameters: {
    docs: {
      description: {
        story: 'An approval-style vote supporting multiple candidates/options.',
      },
    },
  },
};

export const HighVotingPower: Story = {
  args: {
    item: {
      ...mockVoteFor,
      votingPower: 15750000,
      relativeVotingPower: 0.95,
    },
    voteWithVoter: {
      ...mockVoterAuthor,
      ens: 'whale.eth',
      latestVotingPower: 15750000,
      votingPower: 15750000,
    },
    group: mockGroup,
  },
  parameters: {
    docs: {
      description: {
        story:
          'A vote from a high-power delegate showing number formatting for large voting power.',
      },
    },
  },
};

export const NoReasoning: Story = {
  args: {
    item: {
      ...mockVoteFor,
      reason: '',
    },
    voteWithVoter: mockVoterAuthor,
    group: mockGroup,
  },
  parameters: {
    docs: {
      description: {
        story: 'A vote without reasoning text, showing the minimal layout.',
      },
    },
  },
};

export const LongReasoning: Story = {
  args: {
    item: {
      ...mockVoteFor,
      reason:
        'I support this proposal after careful consideration of the technical specifications, economic implications, and community feedback. The proposed changes align with our long-term vision for decentralized governance and will significantly improve user experience while maintaining security. The implementation timeline is realistic and the budget allocation is appropriate for the scope of work. I particularly appreciate the emphasis on community involvement throughout the development process.',
    },
    voteWithVoter: mockVoterAuthor,
    group: mockGroup,
  },
  parameters: {
    docs: {
      description: {
        story:
          'A vote with extensive reasoning text demonstrating text wrapping and layout.',
      },
    },
  },
};

export const RecentVote: Story = {
  args: {
    item: {
      ...mockVoteFor,
      createdAt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
    },
    voteWithVoter: mockVoterAuthor,
    group: mockGroup,
  },
  parameters: {
    docs: {
      description: {
        story: 'A recently cast vote showing relative time formatting.',
      },
    },
  },
};

export const WithForumLink: Story = {
  args: {
    item: {
      ...mockVoteFor,
      reason:
        'I support this proposal for the reasons outlined in my detailed analysis. https://forum.arbitrum.foundation/t/governance-improvement-proposal/123/15',
    },
    voteWithVoter: mockVoterAuthor,
    group: mockGroup,
  },
  parameters: {
    docs: {
      description: {
        story:
          'A vote with reasoning that includes a link to a forum post, showing the "jump to post" functionality.',
      },
    },
  },
};

export const Loading: StoryObj<typeof SkeletonVoteItemFeed> = {
  render: () => <SkeletonVoteItemFeed />,
  parameters: {
    docs: {
      description: {
        story: 'Loading skeleton state for the VoteItem component.',
      },
    },
  },
};
