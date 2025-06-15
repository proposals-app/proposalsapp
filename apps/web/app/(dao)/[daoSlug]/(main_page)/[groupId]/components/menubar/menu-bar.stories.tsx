import type { Meta, StoryObj } from '@storybook/nextjs';
import { MenuBar, ViewEnum } from './menu-bar';
import { FullViewBar } from './full-view-bar';
import { BodyViewBar } from './body-view-bar';
import { CommentsViewBar } from './comments-view-bar';
import {
  LoadingMenuBar,
  LoadingBodyViewBar,
  LoadingCommentsViewBar,
} from './loading-menu-bar';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { useState } from 'react';

const meta: Meta<typeof MenuBar> = {
  title: 'DAO/MenuBar',
  component: MenuBar,
  decorators: [
    (Story) => (
      <NuqsAdapter>
        <Story />
      </NuqsAdapter>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'light',
    },
  },
  args: {
    currentVersion: 1,
    diff: false,
  },
  argTypes: {
    currentVersion: {
      control: 'number',
    },
    diff: {
      control: 'boolean',
    },
  },
};

export default meta;
type Story = StoryObj<typeof MenuBar>;

export const Default: Story = {
  args: {
    bodyVersions: [
      {
        type: 'onchain',
        title: 'Original Proposal',
        content: 'This is the original proposal body content.',
        author_name: 'John Doe',
        author_picture: '/placeholder-avatar.png',
        createdAt: new Date('2025-06-10T10:00:00.000Z'),
      },
    ],
  },
};

export const WithMultipleVersions: Story = {
  args: {
    bodyVersions: [
      {
        type: 'onchain',
        title: 'Original Proposal',
        content: 'This is the original proposal body content.',
        author_name: 'John Doe',
        author_picture: '/placeholder-avatar.png',
        createdAt: new Date('2025-06-10T10:00:00.000Z'),
      },
      {
        type: 'offchain',
        title: 'Updated Proposal',
        content: 'This is the updated proposal with changes.',
        author_name: 'Jane Smith',
        author_picture: '/placeholder-avatar.png',
        createdAt: new Date('2025-06-11T14:30:00.000Z'),
      },
      {
        type: 'onchain',
        title: 'Final Proposal',
        content: 'This is the final version ready for voting.',
        author_name: 'John Doe',
        author_picture: '/placeholder-avatar.png',
        createdAt: new Date('2025-06-12T09:15:00.000Z'),
      },
    ],
    currentVersion: 1,
  },
};

export const WithDiffEnabled: Story = {
  args: {
    ...WithMultipleVersions.args,
    diff: true,
  },
};

export const DiscussionOnly: Story = {
  args: {
    bodyVersions: [
      {
        type: 'topic',
        title: 'Community Discussion',
        content: 'This is a discussion topic without formal proposals.',
        author_name: 'Community Member',
        author_picture: '/placeholder-avatar.png',
        createdAt: new Date('2025-06-13T16:00:00.000Z'),
      },
    ],
  },
};

export const Loading = {
  render: () => <LoadingMenuBar />,
  parameters: {
    docs: {
      description: {
        story: 'Loading skeleton for the full view menu bar',
      },
    },
  },
};

export const LoadingBodyView = {
  render: () => <LoadingBodyViewBar />,
  parameters: {
    docs: {
      description: {
        story: 'Loading skeleton for the body view menu bar (pinned to bottom)',
      },
    },
  },
};

export const LoadingCommentsView = {
  render: () => <LoadingCommentsViewBar />,
  parameters: {
    docs: {
      description: {
        story:
          'Loading skeleton for the comments view menu bar (pinned to top)',
      },
    },
  },
};

// Individual MenuBar Components
export const FullView = {
  render: () => {
    const [view, setView] = useState(ViewEnum.FULL);
    return (
      <NuqsAdapter>
        <FullViewBar view={view} setView={setView} includesProposals={true} />
      </NuqsAdapter>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Full view menu bar with expand/collapse and filter options',
      },
    },
  },
};

export const FullViewDiscussionOnly = {
  render: () => {
    const [view, setView] = useState(ViewEnum.FULL);
    return (
      <NuqsAdapter>
        <FullViewBar view={view} setView={setView} includesProposals={false} />
      </NuqsAdapter>
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'Full view menu bar for discussion-only content (no proposal filters)',
      },
    },
  },
};

export const BodyView = {
  render: () => {
    const [view, setView] = useState(ViewEnum.BODY);
    return (
      <NuqsAdapter>
        <BodyViewBar
          bodyVersions={[
            {
              type: 'onchain',
              title: 'Original Proposal',
              content: 'This is the original proposal body content.',
              author_name: 'John Doe',
              author_picture: '/placeholder-avatar.png',
              createdAt: new Date('2025-06-10T10:00:00.000Z'),
            },
            {
              type: 'offchain',
              title: 'Updated Proposal',
              content: 'This is the updated proposal with changes.',
              author_name: 'Jane Smith',
              author_picture: '/placeholder-avatar.png',
              createdAt: new Date('2025-06-11T14:30:00.000Z'),
            },
            {
              type: 'onchain',
              title: 'Final Proposal',
              content: 'This is the final version ready for voting.',
              author_name: 'John Doe',
              author_picture: '/placeholder-avatar.png',
              createdAt: new Date('2025-06-12T09:15:00.000Z'),
            },
          ]}
          currentVersion={0}
          view={view}
          setView={setView}
          diff={false}
          includesProposals={true}
        />
      </NuqsAdapter>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Body view menu bar with version navigation and diff toggle',
      },
    },
  },
};

export const BodyViewWithDiff = {
  render: () => {
    const [view, setView] = useState(ViewEnum.BODY);
    return (
      <NuqsAdapter>
        <BodyViewBar
          bodyVersions={[
            {
              type: 'onchain',
              title: 'Original Proposal',
              content: 'This is the original proposal body content.',
              author_name: 'John Doe',
              author_picture: '/placeholder-avatar.png',
              createdAt: new Date('2025-06-10T10:00:00.000Z'),
            },
            {
              type: 'offchain',
              title: 'Updated Proposal',
              content: 'This is the updated proposal with changes.',
              author_name: 'Jane Smith',
              author_picture: '/placeholder-avatar.png',
              createdAt: new Date('2025-06-11T14:30:00.000Z'),
            },
          ]}
          currentVersion={0}
          view={view}
          setView={setView}
          diff={true}
          includesProposals={true}
        />
      </NuqsAdapter>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Body view menu bar with diff enabled',
      },
    },
  },
};

export const CommentsView = {
  render: () => {
    const [view, setView] = useState(ViewEnum.COMMENTS);
    return (
      <NuqsAdapter>
        <CommentsViewBar
          view={view}
          setView={setView}
          includesProposals={true}
        />
      </NuqsAdapter>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Comments view menu bar with filter options',
      },
    },
  },
};

export const CommentsViewDiscussionOnly = {
  render: () => {
    const [view, setView] = useState(ViewEnum.COMMENTS);
    return (
      <NuqsAdapter>
        <CommentsViewBar
          view={view}
          setView={setView}
          includesProposals={false}
        />
      </NuqsAdapter>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Comments view menu bar for discussion-only content',
      },
    },
  },
};
