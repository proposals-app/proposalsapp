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
import { OffchainApprovalVoteModalContent } from './vote-types-modals/offchain/approval-vote';
import { OffchainBasicVoteModalContent } from './vote-types-modals/offchain/basic-vote';
import { OffchainQuadraticVoteModalContent } from './vote-types-modals/offchain/quadratic-vote';
import { OffchainRankedChoiceVoteModalContent } from './vote-types-modals/offchain/ranked-choice-vote';
import { OffchainSingleChoiceVoteModalContent } from './vote-types-modals/offchain/single-choice-vote';
import { OffchainWeightedVoteModalContent } from './vote-types-modals/offchain/weighted-vote';
import { OnchainBasicVoteModalContent } from './vote-types-modals/onchain/basic-vote';

interface VoteButtonProps {
  proposal: Selectable<Proposal>;
  // TODO: Add onVoteSubmit callback prop: (voteData: any) => Promise<void>;
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

export function VoteButton({ proposal }: VoteButtonProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const metadata = proposal.metadata as ProposalMetadata;
  const voteType = metadata?.voteType || 'offchain-basic';

  const choices = Array.isArray(proposal.choices)
    ? (proposal.choices as string[])
    : [];

  // Handle proposals with no valid choices
  if (choices.length === 0) {
    console.warn(`VoteButton: Proposal ${proposal.id} has no valid choices.`);
    return (
      <Button disabled variant='outline'>
        <Vote className='mr-2 h-4 w-4' />
        Vote (No Choices)
      </Button>
    );
  }

  const ModalContentComponent =
    voteModalComponents[voteType] || OffchainBasicVoteModalContent; // Fallback to basic

  const handleVoteSubmit = async (voteData: unknown) => {
    console.log('Submitting vote:', voteData);
    // TODO: Implement actual vote submission logic using a server action
    // await onVoteSubmit(voteData);
    setIsOpen(false); // Close modal on submit
  };

  // Check if voting period has ended
  const now = new Date();
  const proposalEndDate = new Date(proposal.endAt);
  const isVotingEnded = now > proposalEndDate;

  if (isVotingEnded) {
    return (
      <Button disabled variant='outline'>
        <Vote className='mr-2 h-4 w-4' />
        Voting Ended
      </Button>
    );
  }

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
          {/* Optional: Add DialogDescription here */}
        </DialogHeader>
        <ModalContentComponent
          proposal={proposal}
          choices={choices}
          onVoteSubmit={handleVoteSubmit}
          onClose={() => setIsOpen(false)}
        />
        {/* Footer might be rendered within ModalContentComponent for flexibility */}
      </DialogContent>
    </Dialog>
  );
}
