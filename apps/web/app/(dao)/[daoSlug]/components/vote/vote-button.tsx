'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import type { ProposalMetadata } from '@/lib/types';
import type { Proposal, Selectable } from '@proposalsapp/db';
import { Vote } from 'lucide-react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { OffchainApprovalVoteModalContent } from './vote-types-modals/offchain/approval-vote';
import { OffchainBasicVoteModalContent } from './vote-types-modals/offchain/basic-vote';
import { OffchainQuadraticVoteModalContent } from './vote-types-modals/offchain/quadratic-vote';
import { OffchainRankedChoiceVoteModalContent } from './vote-types-modals/offchain/ranked-choice-vote';
import { OffchainSingleChoiceVoteModalContent } from './vote-types-modals/offchain/single-choice-vote';
import { OffchainWeightedVoteModalContent } from './vote-types-modals/offchain/weighted-vote';
import { OnchainArbitrumCoreBasicVoteModalContent } from './vote-types-modals/onchain/arbitrum-core-basic-vote';
import { OnchainArbitrumTreasuryBasicVoteModalContent } from './vote-types-modals/onchain/arbitrum-treasury-basic-vote';

export const SNAPSHOT_APP_NAME = 'proposalsapp';
export const ATTRIBUTION_TEXT = 'voted via proposals.app';

const SNAPSHOT_SPACE_ARB_FOUNDATION = 'arbitrumfoundation.eth';
const SNAPSHOT_HUB_URL = 'https://hub.snapshot.org';

interface VoteButtonProps {
  proposal: Selectable<Proposal>;
  governor: 'ARBITRUM_SNAPSHOT' | 'ARBITRUM_CORE' | 'ARBITRUM_TREASURY';
  overwriteSnapshotSpace?: string;
  overwriteSnapshotHub?: string;
}

export interface VoteModalContentProps {
  proposal: Selectable<Proposal>;
  snapshotSpace?: string;
  snapshotHubUrl?: string;
  choices: string[];
  onVoteSubmit: () => Promise<void>;
  onClose: () => void;
}

// Offchain (Snapshot) specific modal components based on vote type
const snapshotVoteModalComponents = {
  approval: OffchainApprovalVoteModalContent,
  basic: OffchainBasicVoteModalContent,
  quadratic: OffchainQuadraticVoteModalContent,
  'ranked-choice': OffchainRankedChoiceVoteModalContent,
  'single-choice': OffchainSingleChoiceVoteModalContent,
  weighted: OffchainWeightedVoteModalContent,
};

export function VoteButton({
  proposal,
  governor,
  overwriteSnapshotSpace,
  overwriteSnapshotHub,
}: VoteButtonProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const { isConnected } = useAccount();

  // --- Wallet connection check ---
  if (!isConnected) {
    // Show ConnectButton centered or aligned as needed
    return (
      <div className='flex w-full justify-center'>
        <ConnectButton />
      </div>
    );
  }

  // --- Wallet is connected, proceed with vote button logic ---

  const metadata = proposal.metadata as ProposalMetadata | null;
  // Ensure voteType is compatible with snapshotVoteModalComponents keys if it's offchain
  const voteType = metadata?.voteType as
    | keyof typeof snapshotVoteModalComponents
    | 'basic'
    | undefined; // Assuming 'basic' might be used for onchain

  if (!voteType) {
    console.warn(`VoteButton: Proposal ${proposal.id} has no valid vote type.`);
    return (
      <Button disabled variant='outline' className='w-min'>
        <Vote className='mr-2 h-4 w-4' />
        Unknown Vote Type
      </Button>
    );
  }

  const choices = Array.isArray(proposal.choices)
    ? (proposal.choices as string[])
    : [];

  // Handle proposals with no valid choices
  if (choices.length === 0) {
    console.warn(`VoteButton: Proposal ${proposal.id} has no valid choices.`);
    return (
      <Button disabled variant='outline' className='w-min'>
        <Vote className='mr-2 h-4 w-4' />
        Unknown Vote Choices
      </Button>
    );
  }

  // Check if voting period has ended
  const now = new Date();
  const proposalEndDate = new Date(proposal.endAt);
  const proposalStartDate = new Date(proposal.startAt);
  const isVotingEnded = now > proposalEndDate;
  const isVotingStarted = now > proposalStartDate;

  if (isVotingEnded) {
    return (
      <Button disabled variant='outline' className='w-min'>
        <Vote className='mr-2 h-4 w-4' />
        Voting Ended
      </Button>
    );
  }

  if (!isVotingStarted) {
    return (
      <Button disabled variant='outline' className='w-min'>
        <Vote className='mr-2 h-4 w-4' />
        Vote Not Started
      </Button>
    );
  }

  let snapshotSpace: string | undefined;
  let snapshotHubUrl: string | undefined;

  // Use a less strict type for assignment flexibility, rely on runtime props
  let ModalContentComponent: React.ComponentType<VoteModalContentProps>;

  switch (governor) {
    case 'ARBITRUM_SNAPSHOT':
      snapshotSpace = overwriteSnapshotSpace || SNAPSHOT_SPACE_ARB_FOUNDATION;
      snapshotHubUrl = overwriteSnapshotHub || SNAPSHOT_HUB_URL;
      ModalContentComponent =
        snapshotVoteModalComponents[voteType] || OffchainBasicVoteModalContent;
      break;
    case 'ARBITRUM_CORE':
      ModalContentComponent = OnchainArbitrumCoreBasicVoteModalContent;
      break;
    case 'ARBITRUM_TREASURY':
      ModalContentComponent = OnchainArbitrumTreasuryBasicVoteModalContent;
      break;
    default:
      // Optional: Handle unexpected governor type if necessary
      console.error(`VoteButton: Unknown governor type: ${governor}`);
      return (
        <Button disabled variant='outline' className='w-min'>
          <Vote className='mr-2 h-4 w-4' />
          Unknown Governor
        </Button>
      );
  }

  const handleSuccessfulVote = async () => {
    // This function is called by the modal content component *after* its internal
    // voting logic (offchain signing or onchain transaction) succeeds.
    // Its sole purpose here is to close the dialog.
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant='default' className='w-min'>
          <Vote className='mr-2 h-4 w-4' />
          Cast Your Vote
        </Button>
      </DialogTrigger>
      <DialogContent className='sm:max-w-[525px]'>
        <DialogHeader>
          <DialogTitle>{proposal.name}</DialogTitle>
        </DialogHeader>

        <ModalContentComponent
          proposal={proposal}
          snapshotSpace={snapshotSpace}
          snapshotHubUrl={snapshotHubUrl}
          choices={choices}
          onVoteSubmit={handleSuccessfulVote}
          onClose={() => setIsOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
