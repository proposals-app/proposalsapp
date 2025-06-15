import type { Meta, StoryObj } from '@storybook/nextjs';
import { BodyHeader, BodyHeaderLoading } from './body-header';
import type { BodyVersionNoContentType } from '../../actions';
import { NuqsAdapter } from 'nuqs/adapters/next/app';

const meta = {
  title: 'DAO/Proposal/Header',
  component: BodyHeader,
  decorators: [
    (Story) => (
      <NuqsAdapter>
        <Story />
      </NuqsAdapter>
    ),
  ],
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof BodyHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

const mockBodyVersions: BodyVersionNoContentType[] = [
  {
    title: 'Initial Proposal: Upgrade Protocol to v2',
    author_name: 'alice.eth',
    author_picture: 'https://i.pravatar.cc/150?u=alice',
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
    type: 'topic',
  },
  {
    title: 'Updated: Added Technical Specifications',
    author_name: 'bob.eth',
    author_picture: 'https://i.pravatar.cc/150?u=bob',
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
    type: 'topic',
  },
  {
    title: 'Final Version: Ready for On-Chain Vote',
    author_name: 'alice.eth',
    author_picture: 'https://i.pravatar.cc/150?u=alice',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    type: 'onchain',
  },
];

export const Default: Story = {
  args: {
    groupName: 'Upgrade Protocol to v2',
    originalAuthorName: 'alice.eth',
    originalAuthorPicture: 'https://i.pravatar.cc/150?u=alice',
    firstBodyVersionCreatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    bodyVersionsNoContent: mockBodyVersions,
  },
};

export const LongTitle: Story = {
  args: {
    groupName:
      'Proposal to Implement Comprehensive Governance Framework Updates Including Delegation Mechanics and Voting Power Calculations',
    originalAuthorName: 'governance-lead.eth',
    originalAuthorPicture: 'https://i.pravatar.cc/150?u=governance',
    firstBodyVersionCreatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    bodyVersionsNoContent: mockBodyVersions,
  },
};

export const SingleVersion: Story = {
  args: {
    groupName: 'Simple Treasury Transfer',
    originalAuthorName: 'treasury.eth',
    originalAuthorPicture: 'https://i.pravatar.cc/150?u=treasury',
    firstBodyVersionCreatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    bodyVersionsNoContent: [mockBodyVersions[0]],
  },
};

export const ManyRevisions: Story = {
  args: {
    groupName: 'Complex Protocol Upgrade with Multiple Iterations',
    originalAuthorName: 'dev-team.eth',
    originalAuthorPicture: 'https://i.pravatar.cc/150?u=devteam',
    firstBodyVersionCreatedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
    bodyVersionsNoContent: [
      ...mockBodyVersions,
      {
        title: 'Community Feedback Incorporated',
        author_name: 'community.eth',
        author_picture: 'https://i.pravatar.cc/150?u=community',
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        type: 'topic',
      },
      {
        title: 'Security Audit Results Added',
        author_name: 'security.eth',
        author_picture: 'https://i.pravatar.cc/150?u=security',
        createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
        type: 'topic',
      },
      {
        title: 'Final Vote Parameters Set',
        author_name: 'alice.eth',
        author_picture: 'https://i.pravatar.cc/150?u=alice',
        createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
        type: 'offchain',
      },
    ],
  },
};

export const RecentPost: Story = {
  args: {
    groupName: 'Emergency Parameter Update',
    originalAuthorName: 'security-council.eth',
    originalAuthorPicture: 'https://i.pravatar.cc/150?u=security-council',
    firstBodyVersionCreatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    bodyVersionsNoContent: [
      {
        title: 'Emergency Parameter Update Required',
        author_name: 'security-council.eth',
        author_picture: 'https://i.pravatar.cc/150?u=security-council',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        type: 'onchain',
      },
    ],
  },
};

export const LongAuthorName: Story = {
  args: {
    groupName: 'Community Funding Proposal',
    originalAuthorName: 'very-long-ethereum-name-with-many-characters.eth',
    originalAuthorPicture: 'https://i.pravatar.cc/150?u=longname',
    firstBodyVersionCreatedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
    bodyVersionsNoContent: mockBodyVersions.slice(0, 2),
  },
};

export const Loading = {
  render: () => <BodyHeaderLoading />,
  parameters: {
    docs: {
      description: {
        story: 'Loading skeleton state for the BodyHeader component',
      },
    },
  },
};
