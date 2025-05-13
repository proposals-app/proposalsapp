'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'; // Assuming RadioGroup components exist
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Selectable, Proposal } from '@proposalsapp/db-indexer';

interface OnchainBasicVoteModalContentProps {
  proposal: Selectable<Proposal>;
  choices: string[];
  snapshotSpace?: string;
  snapshotHubUrl?: string;
  governorAddress?: string;
  onVoteSubmit: (voteData: {
    proposalId: string;
    choice: number;
    reason: string;
  }) => Promise<void>;
  onClose: () => void;
}

export function OnchainBasicVoteModalContent({
  proposal,
  choices,
  onVoteSubmit,
  onClose,
}: OnchainBasicVoteModalContentProps) {
  const [selectedChoice, setSelectedChoice] = React.useState<string>(''); // Store the 1-based index as string
  const [reason, setReason] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async () => {
    if (!selectedChoice) return; // Ensure a choice is made

    setIsSubmitting(true);
    try {
      await onVoteSubmit({
        proposalId: proposal.id,
        choice: parseInt(selectedChoice, 10), // Send the 1-based index as number
        reason: reason,
      });
      // onSuccess handled by parent (closing modal)
    } catch (error) {
      console.error('Failed to submit basic vote:', error);
      // TODO: Add user feedback for error
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className='space-y-4 py-4'>
      <div className='space-y-2'>
        <Label className='text-base font-semibold'>Select Choice</Label>
        <p className='text-sm text-neutral-500 dark:text-neutral-400'>
          Select only one option.
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
