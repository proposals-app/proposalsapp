import type { Meta, StoryObj } from '@storybook/nextjs';
import { ArbitrumSummaryHeader } from './arbitrum-summary-header';
import { SkeletonHeader } from '@/app/components/ui/skeleton';

const meta: Meta<typeof ArbitrumSummaryHeader> = {
  title: 'DAO Components/Arbitrum Summary Header',
  component: ArbitrumSummaryHeader,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    activeGroupsCount: 12,
    totalProposalsCount: 347,
    totalTopicsCount: 1205,
    tokenPrice: 0.85,
    totalVp: 1250000000,
    treasuryBalance: 4200000000,
  },
};

export const HighActivity: Story = {
  args: {
    activeGroupsCount: 28,
    totalProposalsCount: 892,
    totalTopicsCount: 3421,
    tokenPrice: 1.23,
    totalVp: 2800000000,
    treasuryBalance: 8900000000,
  },
};

export const LowActivity: Story = {
  args: {
    activeGroupsCount: 3,
    totalProposalsCount: 45,
    totalTopicsCount: 156,
    tokenPrice: 0.42,
    totalVp: 450000000,
    treasuryBalance: 1200000000,
  },
};

export const WithNullValues: Story = {
  args: {
    activeGroupsCount: 8,
    totalProposalsCount: 234,
    totalTopicsCount: 876,
    tokenPrice: null,
    totalVp: null,
    treasuryBalance: null,
  },
};

export const ZeroValues: Story = {
  args: {
    activeGroupsCount: 0,
    totalProposalsCount: 0,
    totalTopicsCount: 0,
    tokenPrice: 0,
    totalVp: 0,
    treasuryBalance: 0,
  },
};

export const LoadingSkeleton: StoryObj = {
  render: () => <SkeletonHeader />,
  name: 'Loading Skeleton',
  parameters: {
    docs: {
      description: {
        story: 'Loading skeleton state that matches the structure of the Arbitrum summary header. Uses the blueprint design system with dashed borders and diagonal patterns.',
      },
    },
  },
};
