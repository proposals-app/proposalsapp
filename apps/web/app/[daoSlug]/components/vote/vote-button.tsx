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
import { ApprovalVoteModalContent } from './vote-types-modals/approval-vote';
import { BasicVoteModalContent } from './vote-types-modals/basic-vote';
import { QuadraticVoteModalContent } from './vote-types-modals/quadratic-vote';
import { RankedChoiceVoteModalContent } from './vote-types-modals/ranked-choice-vote';
import { SingleChoiceVoteModalContent } from './vote-types-modals/single-choice-vote';
import { WeightedVoteModalContent } from './vote-types-modals/weighted-vote';
import { Vote } from 'lucide-react';

interface VoteButtonProps {
  proposal: Selectable<Proposal>;
  // TODO: Add onVoteSubmit callback prop: (voteData: any) => Promise<void>;
}

const voteModalComponents = {
  approval: ApprovalVoteModalContent,
  basic: BasicVoteModalContent,
  quadratic: QuadraticVoteModalContent, // Assuming Quadratic uses basic selection UI for now
  'ranked-choice': RankedChoiceVoteModalContent,
  'single-choice': SingleChoiceVoteModalContent, // Often same as basic
  weighted: WeightedVoteModalContent,
};

export function VoteButton({ proposal }: VoteButtonProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const metadata = proposal.metadata as ProposalMetadata;
  const voteType = metadata?.voteType || 'basic'; // Default to basic if undefined

  // Ensure choices is an array of strings
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
    voteModalComponents[voteType] || BasicVoteModalContent; // Fallback to basic

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
