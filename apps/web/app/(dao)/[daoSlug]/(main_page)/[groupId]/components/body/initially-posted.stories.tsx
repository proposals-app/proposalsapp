import type { Meta, StoryObj } from '@storybook/nextjs';
import { InitiallyPosted } from './initially-posted';
import { SkeletonInitiallyPosted } from '@/app/components/ui/skeleton';

const meta: Meta<typeof InitiallyPosted> = {
  title: 'Group Page/Body/InitiallyPosted',
  component: InitiallyPosted,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Component that displays when a proposal was initially posted with relative time formatting.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    createdAt: {
      control: 'date',
      description: 'The date when the content was created',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

const now = new Date();
const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

export const Default: Story = {
  args: {
    createdAt: oneHourAgo,
  },
};

export const OneDay: Story = {
  args: {
    createdAt: oneDayAgo,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Shows how the component displays time for content posted one day ago.',
      },
    },
  },
};

export const OneWeek: Story = {
  args: {
    createdAt: oneWeekAgo,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Shows how the component displays time for content posted one week ago.',
      },
    },
  },
};

export const OneMonth: Story = {
  args: {
    createdAt: oneMonthAgo,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Shows how the component displays time for content posted one month ago.',
      },
    },
  },
};

export const LoadingSkeleton: Story = {
  render: () => <SkeletonInitiallyPosted />,
  parameters: {
    docs: {
      description: {
        story:
          'Loading skeleton that matches the InitiallyPosted component dimensions.',
      },
    },
  },
};
