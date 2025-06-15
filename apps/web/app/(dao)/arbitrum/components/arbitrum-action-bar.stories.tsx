import type { Meta, StoryObj } from '@storybook/nextjs';
import { ArbitrumActionBar } from './arbitrum-action-bar';
import { SkeletonActionBar } from '@/app/components/ui/skeleton';
import { chromaticModes } from '@/.storybook/chromatic-decorator';

const meta: Meta<typeof ArbitrumActionBar> = {
  title: 'DAO/Headers/ActionBar',
  component: ArbitrumActionBar,
  parameters: {
    layout: 'fullscreen',
    ...chromaticModes.default,
    docs: {
      description: {
        component:
          'Action bar component that appears between the Arbitrum summary header and group list. Shows the page heading and conditionally displays a "Mark all as read" button based on user authentication and activity status.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    hasNewActivity: {
      control: 'boolean',
      description: 'Whether there are groups with new activity',
    },
    signedIn: {
      control: 'boolean',
      description: 'Whether the user is signed in',
    },
    onMarkAllAsRead: {
      description: 'Callback function when mark all as read is clicked',
    },
    isMarkingAsRead: {
      control: 'boolean',
      description: 'Whether the mark as read action is in progress',
    },
  },
  args: {
    onMarkAllAsRead: () => {},
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const SignedOutUser: Story = {
  args: {
    hasNewActivity: true,
    signedIn: false,
    isMarkingAsRead: false,
  },
  parameters: {
    docs: {
      description: {
        story:
          'When user is not signed in, only the heading is shown regardless of activity status.',
      },
    },
  },
};

export const SignedInNoActivity: Story = {
  args: {
    hasNewActivity: false,
    signedIn: true,
    isMarkingAsRead: false,
  },
  parameters: {
    docs: {
      description: {
        story:
          'When user is signed in but there are no groups with new activity, only the heading is shown.',
      },
    },
  },
};

export const SignedInWithActivity: Story = {
  args: {
    hasNewActivity: true,
    signedIn: true,
    isMarkingAsRead: false,
  },
  parameters: {
    docs: {
      description: {
        story:
          'When user is signed in and there are groups with new activity, both heading and "Mark all as read" button are shown.',
      },
    },
  },
};

export const MarkingAsReadLoading: Story = {
  args: {
    hasNewActivity: true,
    signedIn: true,
    isMarkingAsRead: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Loading state when the mark as read action is in progress. Button is disabled and shows loading text.',
      },
    },
  },
};

export const LoadingSkeleton: StoryObj = {
  render: () => <SkeletonActionBar />,
  parameters: {
    docs: {
      description: {
        story:
          'Loading skeleton state that matches the structure of the action bar. Shows placeholder elements while data is being fetched.',
      },
    },
    ...chromaticModes.layout,
  },
};
