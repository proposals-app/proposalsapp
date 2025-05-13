'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ProposalMetadata } from '@/lib/types';
import { Selectable, Proposal } from '@proposalsapp/db-indexer';
import { Vote } from 'lucide-react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { OffchainApprovalVoteModalContent } from './vote-types-modals/offchain/approval-vote';
import { OffchainBasicVoteModalContent } from './vote-types-modals/offchain/basic-vote';
import { OffchainQuadraticVoteModalContent } from './vote-types-modals/offchain/quadratic-vote';
import { OffchainRankedChoiceVoteModalContent } from './vote-types-modals/offchain/ranked-choice-vote';
import { OffchainSingleChoiceVoteModalContent } from './vote-types-modals/offchain/single-choice-vote';
import { OffchainWeightedVoteModalContent } from './vote-types-modals/offchain/weighted-vote';
import { OnchainBasicVoteModalContent } from './vote-types-modals/onchain/basic-vote';

export const SNAPSHOT_APP_NAME = 'proposalsapp';
export const ATTRIBUTION_TEXT = 'voted via proposals.app';

const SNAPSHOT_SPACE_ARB_FOUNDATION = 'arbitrumfoundation.eth';
const SNAPSHOT_HUB_URL = 'https://hub.snapshot.org';
const ARBITRUM_CORE_GOVERNOR_ADDRESS =
  '0xf07DeD9dC292157749B6Fd268E37DF6EA38395B9';
const ARBITRUM_TREASURY_GOVERNOR_ADDRESS =
  '0x789fC99093B09aD01C34DC7251D0C89ce743e5a4';

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
  governorAddress?: string;
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
      <Button disabled variant='outline' className='w-full'>
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
      <Button disabled variant='outline' className='w-full'>
        <Vote className='mr-2 h-4 w-4' />
        Unknown Vote Choices
      </Button>
    );
  }

  // Check if voting period has ended
  const now = new Date();
  const proposalEndDate = new Date(proposal.endAt);
  const isVotingEnded = now > proposalEndDate;

  if (isVotingEnded) {
    return (
      <Button disabled variant='outline' className='w-full'>
        <Vote className='mr-2 h-4 w-4' />
        Voting Ended
      </Button>
    );
  }

  let snapshotSpace: string | undefined;
  let snapshotHubUrl: string | undefined;
  let governorAddress: `0x${string}` | undefined;
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
      governorAddress = ARBITRUM_CORE_GOVERNOR_ADDRESS;
      ModalContentComponent = OnchainBasicVoteModalContent;
      break;
    case 'ARBITRUM_TREASURY':
      governorAddress = ARBITRUM_TREASURY_GOVERNOR_ADDRESS;
      ModalContentComponent = OnchainBasicVoteModalContent;
      break;
    default:
      // Optional: Handle unexpected governor type if necessary
      console.error(`VoteButton: Unknown governor type: ${governor}`);
      return (
        <Button disabled variant='outline' className='w-full'>
          <Vote className='mr-2 h-4 w-4' />
          Invalid Governor
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
        <Button variant='default' className='w-full'>
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
          governorAddress={governorAddress}
          choices={choices}
          onVoteSubmit={handleSuccessfulVote}
          onClose={() => setIsOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
