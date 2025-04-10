'use client';

// NOTE: Snapshot's standard Quadratic Voting UI often simplifies to single-choice
// selection, as the quadratic calculation happens based on the voter's VP, not
// user-inputted "credits". This implementation reflects that common pattern.
// If a credit-based system is needed, this component would require significant changes
// (e.g., sliders, input validation).

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Selectable, Proposal } from '@proposalsapp/db-indexer';

interface OffchainQuadraticVoteModalContentProps {
  proposal: Selectable<Proposal>;
  choices: string[];
  onVoteSubmit: (voteData: {
    proposalId: string;
    choice: number; // Or potentially Record<string, number> if credit-based
    reason: string;
  }) => Promise<void>;
  onClose: () => void;
}

export function OffchainQuadraticVoteModalContent({
  proposal,
  choices,
  onVoteSubmit,
  onClose,
}: OffchainQuadraticVoteModalContentProps) {
  // Assuming single choice selection for simplicity, mirroring 'basic' vote UI
  const [selectedChoice, setSelectedChoice] = React.useState<string>('');
  const [reason, setReason] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async () => {
    if (!selectedChoice) return;

    setIsSubmitting(true);
    try {
      // The backend/snapshot client handles the sqrt(vp) calculation.
      // We just send the selected choice index (1-based).
      await onVoteSubmit({
        proposalId: proposal.id,
        choice: parseInt(selectedChoice, 10),
        reason: reason,
      });
    } catch (error) {
      console.error('Failed to submit quadratic vote:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className='space-y-4 py-4'>
      <div className='space-y-2'>
        <Label className='text-base font-semibold'>Select Choice</Label>
        <p className='text-sm text-neutral-500 dark:text-neutral-400'>
          Select one option. Your vote&apos;s influence will be calculated
          quadratically based on your voting power.
        </p>
        <RadioGroup
          value={selectedChoice}
          onValueChange={setSelectedChoice}
          className='space-y-2 pt-2'
        >
          {choices.map((choice, index) => (
            <div key={index} className='flex items-center space-x-2'>
              <RadioGroupItem value={`${index + 1}`} id={`choice-${index}`} />
              <Label
                htmlFor={`choice-${index}`}
                className='flex-1 cursor-pointer text-sm'
              >
                {choice}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      <div className='space-y-2'>
        <Label htmlFor='reason' className='text-base font-semibold'>
          Reason (Optional)
        </Label>
        <Textarea
          id='reason'
          placeholder='Why are you voting this way?'
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className='min-h-[80px]'
        />
      </div>

      <DialogFooter>
        <DialogClose asChild>
          <Button type='button' variant='outline'>
            Cancel
          </Button>
        </DialogClose>
        <Button
          type='button'
          onClick={handleSubmit}
          disabled={isSubmitting || !selectedChoice}
        >
          {isSubmitting ? 'Submitting...' : 'Submit Vote'}
        </Button>
      </DialogFooter>
    </div>
  );
}
