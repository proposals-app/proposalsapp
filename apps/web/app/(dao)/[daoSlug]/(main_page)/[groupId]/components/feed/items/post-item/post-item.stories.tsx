import type { Meta, StoryObj } from '@storybook/nextjs';
import { PostItem } from './post-item';
import { SkeletonPostItem } from '@/app/components/ui/skeleton';
import { actionController } from '@/.storybook/mocks/action-controller';
import {
  mockPost,
  mockLongPost,
  mockDeletedPost,
  mockGroup,
  mockDiscourseUser,
  mockDelegate,
} from '@/.storybook/mock-data';

const meta: Meta<typeof PostItem> = {
  title: 'DAO/Feed/Items/PostItem',
  component: PostItem,
  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'light',
    },
    docs: {
      description: {
        component:
          'Displays Discourse forum posts in the feed with author information, voting power, content processing, likes/views, and read-more functionality for long posts.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof PostItem>;

export const Default: Story = {
  args: {
    item: mockPost,
    group: mockGroup,
  },
  loaders: [
    async () => {
      // Configure the mocks for this story
      actionController.getDiscourseUser = async () => mockDiscourseUser;
      actionController.getPostLikesCount = async () => 42;
      actionController.getDelegateByDiscourseUser = async () => mockDelegate;
      return {};
    },
  ],
  parameters: {
    docs: {
      description: {
        story:
          'A standard forum post with author information, voting power tag, and engagement metrics.',
      },
    },
  },
};

export const LongContent: Story = {
  args: {
    item: mockLongPost,
    group: mockGroup,
  },
  loaders: [
    async () => {
      actionController.getDiscourseUser = async () => ({
        ...mockDiscourseUser,
        username: 'protocol.researcher',
        name: 'Protocol Researcher',
      });
      actionController.getPostLikesCount = async () => 127;
      actionController.getDelegateByDiscourseUser = async () => ({
        ...mockDelegate,
        delegatetovoter: {
          ens: 'protocol.researcher.eth',
          latestVotingPower: { votingPower: 2500000 },
        },
      });
      return {};
    },
  ],
  parameters: {
    docs: {
      description: {
        story:
          'A post with extensive content that demonstrates the read-more/collapse functionality when content exceeds the threshold.',
      },
    },
  },
};

export const HighEngagement: Story = {
  args: {
    item: {
      ...mockPost,
      reads: 2847,
    },
    group: mockGroup,
  },
  parameters: {
    docs: {
      description: {
        story:
          'A post with high engagement showing large numbers for likes and views.',
      },
    },
  },
};

export const RecentPost: Story = {
  args: {
    item: {
      ...mockPost,
      createdAt: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
      updatedAt: new Date(Date.now() - 15 * 60 * 1000),
    },
    group: mockGroup,
  },
  parameters: {
    docs: {
      description: {
        story: 'A recently created post showing relative time formatting.',
      },
    },
  },
};

export const EditedPost: Story = {
  args: {
    item: {
      ...mockPost,
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      updatedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
    },
    group: mockGroup,
  },
  parameters: {
    docs: {
      description: {
        story:
          'A post that has been edited, showing both creation and update timestamps.',
      },
    },
  },
};

export const DeletedPost: Story = {
  args: {
    item: mockDeletedPost,
    group: mockGroup,
  },
  parameters: {
    docs: {
      description: {
        story:
          'A deleted post that shows the collapsed "Deleted Post" indicator without content.',
      },
    },
  },
};

export const MinimalContent: Story = {
  args: {
    item: {
      ...mockPost,
      cooked: '<p>Short update: All systems operational. ✅</p>',
      reads: 45,
    },
    group: mockGroup,
  },
  parameters: {
    docs: {
      description: {
        story:
          'A post with minimal content that does not trigger the read-more functionality.',
      },
    },
  },
};

export const WithCodeBlock: Story = {
  args: {
    item: {
      ...mockPost,
      cooked: `
        <p>Here's the proposed smart contract implementation:</p>
        <pre><code class="language-solidity">
pragma solidity ^0.8.0;

contract GovernanceToken {
    string public name = "DAO Token";
    string public symbol = "DAO";
    uint8 public decimals = 18;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(uint256 _totalSupply) {
        balanceOf[msg.sender] = _totalSupply;
    }
}
        </code></pre>
        <p>This implementation provides the basic functionality we need for governance voting.</p>
      `,
    },
    group: mockGroup,
  },
  parameters: {
    docs: {
      description: {
        story:
          'A post containing code blocks to demonstrate syntax highlighting and formatting.',
      },
    },
  },
};

export const WithQuote: Story = {
  args: {
    item: {
      ...mockPost,
      cooked: `
        <p>I want to address the concern raised by @alice.eth in the previous discussion:</p>
        <blockquote>
          <p>The current proposal lacks sufficient detail about implementation timelines and budget allocation.</p>
        </blockquote>
        <p>You're absolutely right. I've updated the proposal to include a detailed timeline and budget breakdown. Thank you for the feedback!</p>
      `,
    },
    group: mockGroup,
  },
  parameters: {
    docs: {
      description: {
        story:
          'A post with quoted content showing how blockquotes are rendered in the feed.',
      },
    },
  },
};

export const Loading: StoryObj<typeof SkeletonPostItem> = {
  render: () => <SkeletonPostItem />,
  parameters: {
    docs: {
      description: {
        story: 'Loading skeleton state for the PostItem component.',
      },
    },
  },
};
