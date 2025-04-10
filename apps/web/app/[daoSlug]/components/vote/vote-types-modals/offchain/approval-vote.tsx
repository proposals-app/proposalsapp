'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox'; // Assuming a Checkbox component exists
import { Textarea } from '@/components/ui/textarea'; // Assuming a Textarea component exists
import { Label } from '@/components/ui/label'; // Assuming a Label component exists
import { DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Selectable, Proposal } from '@proposalsapp/db-indexer';

interface OffchainApprovalVoteModalContentProps {
  proposal: Selectable<Proposal>;
  choices: string[];
  onVoteSubmit: (voteData: {
    proposalId: string;
    choice: number[];
    reason: string;
  }) => Promise<void>;
  onClose: () => void;
}

export function OffchainApprovalVoteModalContent({
  proposal,
  choices,
  onVoteSubmit,
  onClose,
}: OffchainApprovalVoteModalContentProps) {
  const [selectedChoices, setSelectedChoices] = React.useState<number[]>([]);
  const [reason, setReason] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleCheckboxChange = (choiceIndex: number, checked: boolean) => {
    setSelectedChoices((prev) =>
      checked
        ? [...prev, choiceIndex + 1] // Snapshot uses 1-based indexing for choices
        : prev.filter((index) => index !== choiceIndex + 1)
    );
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onVoteSubmit({
        proposalId: proposal.id,
        choice: selectedChoices, // Send array of 1-based indices
        reason: reason,
      });
      // onSuccess handled by parent (closing modal)
    } catch (error) {
      console.error('Failed to submit approval vote:', error);
      // TODO: Add user feedback for error
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className='space-y-4 py-4'>
      <div className='space-y-2'>
        <Label className='text-base font-semibold'>Select Choices</Label>
        <p className='text-sm text-neutral-500 dark:text-neutral-400'>
          Select one or more options you approve of.
        </p>
        <div className='space-y-2 pt-2'>
          {choices.map((choice, index) => (
            <div key={index} className='flex items-center space-x-2'>
              <Checkbox
                id={`choice-${index}`}
                checked={selectedChoices.includes(index + 1)}
                onCheckedChange={(checked) =>
                  handleCheckboxChange(index, !!checked)
                }
              />
              <Label
                htmlFor={`choice-${index}`}
                className='flex-1 cursor-pointer text-sm'
              >
                {choice}
              </Label>
            </div>
          ))}
        </div>
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
          disabled={isSubmitting || selectedChoices.length === 0}
        >
          {isSubmitting ? 'Submitting...' : 'Submit Vote'}
        </Button>
      </DialogFooter>
    </div>
  );
}
