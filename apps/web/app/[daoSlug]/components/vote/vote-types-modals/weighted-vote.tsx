'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Selectable, Proposal } from '@proposalsapp/db-indexer';
import { cn } from '@/lib/utils';

interface WeightedVoteModalContentProps {
  proposal: Selectable<Proposal>;
  choices: string[];
  onVoteSubmit: (voteData: {
    proposalId: string;
    choice: Record<string, number>; // Send { "1": weight1, "2": weight2, ... }
    reason: string;
  }) => Promise<void>;
  onClose: () => void;
}

export function WeightedVoteModalContent({
  proposal,
  choices,
  onVoteSubmit,
  onClose,
}: WeightedVoteModalContentProps) {
  // Initialize weights state { '1': 0, '2': 0, ... }
  const initialWeights = choices.reduce(
    (acc, _, index) => {
      acc[index + 1] = 0; // Use 1-based index as key
      return acc;
    },
    {} as Record<string, number>
  );
  const [weights, setWeights] =
    React.useState<Record<string, number>>(initialWeights);
  const [reason, setReason] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const totalWeight = React.useMemo(() => {
    return Object.values(weights).reduce((sum, weight) => sum + weight, 0);
  }, [weights]);

  const handleWeightChange = (choiceIndexKey: string, value: string) => {
    setError(null); // Clear error on change
    const numValue = parseInt(value, 10);
    const newWeight = isNaN(numValue) || numValue < 0 ? 0 : numValue; // Handle NaN and negative

    setWeights((prev) => ({
      ...prev,
      [choiceIndexKey]: newWeight,
    }));
  };

  React.useEffect(() => {
    // Validate total weight dynamically
    if (totalWeight > 100) {
      setError('Total weight cannot exceed 100%.');
    } else {
      setError(null);
    }
  }, [totalWeight]);

  const handleSubmit = async () => {
    if (error) return; // Don't submit if there's an error
    if (totalWeight === 0) {
      setError('You must allocate some voting power.');
      return;
    }
    // Optional: enforce total weight must be exactly 100%
    // if (totalWeight !== 100) {
    //   setError('Total weight must add up to exactly 100%.');
    //   return;
    // }

    setIsSubmitting(true);
    setError(null);
    try {
      // Filter out choices with 0 weight before submitting
      const votePayload: Record<string, number> = {};
      for (const key in weights) {
        if (weights[key] > 0) {
          votePayload[key] = weights[key];
        }
      }

      await onVoteSubmit({
        proposalId: proposal.id,
        choice: votePayload, // Send object with 1-based index keys and weights
        reason: reason,
      });
    } catch (err) {
      console.error('Failed to submit weighted vote:', err);
      setError('Failed to submit vote. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className='space-y-4 py-4'>
      <div className='space-y-2'>
        <Label className='text-base font-semibold'>Allocate Voting Power</Label>
        <p className='text-sm text-neutral-500 dark:text-neutral-400'>
          Distribute 100% of your voting power across the options below.
        </p>
        <div className='space-y-3 pt-2'>
          {choices.map((choice, index) => {
            const choiceIndexKey = `${index + 1}`; // 1-based index as string key
            return (
              <div
                key={choiceIndexKey}
                className='grid grid-cols-4 items-center gap-x-3 gap-y-1'
              >
                <Label
                  htmlFor={`choice-weight-${choiceIndexKey}`}
                  className='col-span-3 text-sm'
                >
                  {choice}
                </Label>
                <div className='col-span-1 flex items-center space-x-1'>
                  <Input
                    id={`choice-weight-${choiceIndexKey}`}
                    type='number'
                    min='0'
                    max='100' // Technically can be > 100 initially, validation checks total
                    step='1'
                    value={weights[choiceIndexKey]}
                    onChange={(e) =>
                      handleWeightChange(choiceIndexKey, e.target.value)
                    }
                    className={cn(
                      'h-8 w-full appearance-none text-right text-sm',
                      '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none' // Hide number input spinners
                    )}
                  />
                  <span className='text-sm text-neutral-500'>%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Total Weight Display and Error */}
      <div className='flex items-center justify-end space-x-2 pt-2'>
        {error && (
          <p className='text-sm text-red-600 dark:text-red-400'>{error}</p>
        )}
        <Label className='text-sm font-medium'>Total:</Label>
        <span
          className={cn(
            'text-sm font-semibold',
            totalWeight > 100 ? 'text-red-600 dark:text-red-400' : ''
          )}
        >
          {totalWeight}%
        </span>
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
          disabled={isSubmitting || !!error || totalWeight === 0}
        >
          {isSubmitting ? 'Submitting...' : 'Submit Vote'}
        </Button>
      </DialogFooter>
    </div>
  );
}
