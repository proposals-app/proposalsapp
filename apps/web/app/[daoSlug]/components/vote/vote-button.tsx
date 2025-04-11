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

export const SNAPSHOT_HUB_URL = 'https://hub.snapshot.org';
export const SNAPSHOT_SPACE = 'arbitrumfoundation.eth';
export const SNAPSHOT_APP_NAME = 'proposalsapp';
export const ATTRIBUTION_TEXT = 'voted via proposals.app';

interface VoteButtonProps {
  proposal: Selectable<Proposal>;
  space?: string;
}

const voteModalComponents = {
  'offchain-approval': OffchainApprovalVoteModalContent,
  'offchain-basic': OffchainBasicVoteModalContent,
  'offchain-quadratic': OffchainQuadraticVoteModalContent,
  'offchain-ranked-choice': OffchainRankedChoiceVoteModalContent,
  'offchain-single-choice': OffchainSingleChoiceVoteModalContent,
  'offchain-weighted': OffchainWeightedVoteModalContent,
  'onchain-basic': OnchainBasicVoteModalContent,
};

export function VoteButton({
  proposal,
  space = SNAPSHOT_SPACE,
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
  const voteType = metadata?.voteType;

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

  const ModalContentComponent =
    voteModalComponents[voteType] || OffchainBasicVoteModalContent;

  const handleSuccessfulVote = async () => {
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
          <DialogTitle>Cast Your Vote</DialogTitle>
        </DialogHeader>
        {/* Render the selected modal content, passing necessary props */}
        <ModalContentComponent
          proposal={proposal}
          space={space}
          choices={choices}
          onVoteSubmit={handleSuccessfulVote} // Pass the success handler
          onClose={() => setIsOpen(false)} // Pass the close handler for cancellation
        />
      </DialogContent>
    </Dialog>
  );
}
