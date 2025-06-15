import type { Meta, StoryObj } from '@storybook/nextjs';
import { PostedRevisions } from './posted-revision';
import { SkeletonPostedRevisions } from '@/app/components/ui/skeleton';
import type { BodyVersionType } from '../../actions';
import { NuqsAdapter } from 'nuqs/adapters/react';

// Wrapper to provide nuqs adapter for Storybook
function StorybookWrapper({ children }: { children: React.ReactNode }) {
  return <NuqsAdapter>{children}</NuqsAdapter>;
}

const meta: Meta<typeof PostedRevisions> = {
  title: 'Group Page/Body/PostedRevisions',
  component: PostedRevisions,
  decorators: [
    (Story) => (
      <StorybookWrapper>
        <Story />
      </StorybookWrapper>
    ),
  ],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Component that displays a dropdown selector for different versions of content with their revision dates.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    versions: {
      description: 'Array of body versions to select from',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

const now = new Date();
const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

const singleVersion: BodyVersionType[] = [
  {
    type: 'offchain',
    title: 'Sample Proposal',
    content: 'Sample proposal content',
    createdAt: oneHourAgo,
    author_name: 'John Doe',
    author_picture: 'https://avatars.githubusercontent.com/u/1?v=4',
  },
];

const multipleVersionsContent: BodyVersionType[] = [
  {
    type: 'offchain',
    title: 'Original Proposal',
    content: 'Original proposal content',
    createdAt: oneWeekAgo,
    author_name: 'John Doe',
    author_picture: 'https://avatars.githubusercontent.com/u/1?v=4',
  },
  {
    type: 'offchain',
    title: 'Updated Proposal',
    content: 'Updated proposal content',
    createdAt: oneDayAgo,
    author_name: 'John Doe',
    author_picture: 'https://avatars.githubusercontent.com/u/1?v=4',
  },
  {
    type: 'offchain',
    title: 'Latest Proposal',
    content: 'Latest proposal content',
    createdAt: oneHourAgo,
    author_name: 'John Doe',
    author_picture: 'https://avatars.githubusercontent.com/u/1?v=4',
  },
];

const mixedVersions: BodyVersionType[] = [
  {
    type: 'topic',
    title: 'Original Discussion Topic',
    content: 'Original discourse post',
    createdAt: oneWeekAgo,
    author_name: 'Jane Smith',
    author_picture: 'https://avatars.githubusercontent.com/u/2?v=4',
  },
  {
    type: 'offchain',
    title: 'Offchain Proposal Revision',
    content: 'Offchain revision',
    createdAt: oneDayAgo,
    author_name: 'John Doe',
    author_picture: 'https://avatars.githubusercontent.com/u/1?v=4',
  },
  {
    type: 'onchain',
    title: 'Onchain Proposal',
    content: 'Onchain version',
    createdAt: oneHourAgo,
    author_name: 'Alice Johnson',
    author_picture: 'https://avatars.githubusercontent.com/u/3?v=4',
  },
];

export const SingleVersion: Story = {
  args: {
    versions: singleVersion,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Component with only one version available - no dropdown behavior.',
      },
    },
  },
};

export const MultipleContentVersions: Story = {
  args: {
    versions: multipleVersionsContent,
  },
  parameters: {
    docs: {
      description: {
        story: 'Multiple content revisions showing offchain revision labels.',
      },
    },
  },
};

export const MixedVersionTypes: Story = {
  args: {
    versions: mixedVersions,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Mix of discourse, content, and onchain versions showing different revision type labels.',
      },
    },
  },
};

export const DiscourseVersion: Story = {
  args: {
    versions: [
      {
        type: 'topic',
        title: 'Discourse Topic',
        content: 'Discourse forum post',
        createdAt: oneHourAgo,
        author_name: 'Forum User',
        author_picture: 'https://avatars.githubusercontent.com/u/4?v=4',
      },
    ],
  },
  parameters: {
    docs: {
      description: {
        story: 'Single discourse version showing "discourse revision" label.',
      },
    },
  },
};

export const OnchainVersion: Story = {
  args: {
    versions: [
      {
        type: 'onchain',
        title: 'Onchain Proposal',
        content: 'Onchain proposal',
        createdAt: oneHourAgo,
        author_name: 'DAO Member',
        author_picture: 'https://avatars.githubusercontent.com/u/5?v=4',
      },
    ],
  },
  parameters: {
    docs: {
      description: {
        story: 'Single onchain version showing "onchain revision" label.',
      },
    },
  },
};

export const LoadingSkeleton: Story = {
  render: () => <SkeletonPostedRevisions />,
  parameters: {
    docs: {
      description: {
        story:
          'Loading skeleton that matches the PostedRevisions component dimensions.',
      },
    },
  },
};
