'use client';

import * as React from 'react';
import snapshot from '@snapshot-labs/snapshot.js';
import { Web3Provider } from '@ethersproject/providers';
import { useAccount, useWalletClient } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Selectable, Proposal } from '@proposalsapp/db-indexer';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  ATTRIBUTION_TEXT,
  SNAPSHOT_APP_NAME,
  SNAPSHOT_HUB_URL,
} from '../../vote-button';

interface OffchainWeightedVoteModalContentProps {
  proposal: Selectable<Proposal>;
  space: string;
  choices: string[];
  onVoteSubmit: () => Promise<void>; // Simplified: Parent handles success
  onClose: () => void;
}

export function OffchainWeightedVoteModalContent({
  proposal,
  space,
  choices,
  onVoteSubmit,
  onClose,
}: OffchainWeightedVoteModalContentProps) {
  // Initialize weights state { '1': 0, '2': 0, ... }
  const initialWeights = React.useMemo(
    () =>
      choices.reduce(
        (acc, _, index) => {
          acc[index + 1] = 0; // Use 1-based index as key
          return acc;
        },
        {} as Record<string, number>
      ),
    [choices] // Depend on choices array
  );

  const [weights, setWeights] =
    React.useState<Record<string, number>>(initialWeights);
  const [reason, setReason] = React.useState('');
  const [addAttribution, setAddAttribution] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const { data: walletClient } = useWalletClient();
  const { address } = useAccount();

  // Reset weights when choices change (e.g., modal re-renders with different prop)
  React.useEffect(() => {
    setWeights(initialWeights);
  }, [initialWeights]);

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

  // Dynamic validation for exceeding 100%
  React.useEffect(() => {
    if (totalWeight > 100) {
      setError('Total weight cannot exceed 100%.');
    } else {
      // Clear the error only if it was the "exceed 100%" error
      if (error === 'Total weight cannot exceed 100%.') {
        setError(null);
      }
    }
  }, [totalWeight, error]); // Added error dependency to avoid clearing other errors

  const handleSubmit = async () => {
    if (!walletClient || !address) {
      toast.error('Wallet not connected.', { position: 'top-right' });
      return;
    }
    // Explicitly check for exactly 100% on submit
    if (totalWeight !== 100) {
      const newError = 'Total weight must be exactly 100%.';
      setError(newError);
      toast.error(newError, { position: 'top-right' });
      return;
    }
    // Clear any previous errors if validation passes now
    setError(null);

    setIsSubmitting(true);
    const client = new snapshot.Client712(SNAPSHOT_HUB_URL);

    // Construct final reason
    const finalReason = addAttribution
      ? reason.trim()
        ? `${reason.trim()}\n${ATTRIBUTION_TEXT}`
        : ATTRIBUTION_TEXT.trim() // Use only attribution if reason is empty
      : reason;

    try {
      // Filter out choices with 0 weight before submitting (Snapshot might handle this, but explicit is safer)
      const votePayload: Record<string, number> = {};
      for (const key in weights) {
        if (weights[key] > 0) {
          // Snapshot expects integer weights (representing percentages)
          votePayload[key] = weights[key];
        }
      }

      const web3Provider = new Web3Provider(
        walletClient.transport,
        walletClient.chain.id
      );

      const receipt = await client.vote(web3Provider, address, {
        space,
        proposal: proposal.externalId, // Use externalId for Snapshot
        type: 'weighted',
        choice: votePayload, // Send object with 1-based index keys and weights
        reason: finalReason,
        app: SNAPSHOT_APP_NAME,
      });

      console.log('Snapshot vote receipt:', receipt);
      toast.success('Vote submitted successfully!', { position: 'top-right' });
      await onVoteSubmit(); // Notify parent of success
    } catch (error: unknown) {
      console.error('Failed to submit weighted vote via Snapshot:', error);
      let message = 'Unknown error';
      if (typeof error === 'object' && error !== null) {
        // Attempt to access Snapshot's specific error field first
        if (
          'error_description' in error &&
          typeof error.error_description === 'string'
        ) {
          message = error.error_description;
        }
        // Fallback to standard Error message
        else if ('message' in error && typeof error.message === 'string') {
          message = error.message;
        }
      } else if (typeof error === 'string') {
        message = error; // Handle plain string errors
      }
      setError('Failed to submit vote. Please try again.'); // Set state error
      toast.error(`Failed to submit vote: ${message}`, {
        position: 'top-right',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Determine if the button should be disabled
  const isSubmitDisabled =
    isSubmitting ||
    totalWeight !== 100 || // Must be exactly 100
    !walletClient;

  return (
    <div className='space-y-4 py-4'>
      <div className='space-y-2'>
        <Label className='text-base font-semibold'>Allocate Voting Power</Label>
        <p className='text-sm text-neutral-500 dark:text-neutral-400'>
          Distribute exactly 100% of your voting power across the options below.
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
                    max='100'
                    step='1'
                    value={weights[choiceIndexKey] || '0'} // Ensure controlled input, default to '0'
                    onChange={(e) =>
                      handleWeightChange(choiceIndexKey, e.target.value)
                    }
                    disabled={isSubmitting}
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
      <div className='flex min-h-[20px] items-center justify-end space-x-2 pt-2'>
        {' '}
        {/* Added min-h */}
        {error && (
          <p className='flex-1 text-right text-sm text-red-600 dark:text-red-400'>
            {' '}
            {/* Adjusted alignment */}
            {error}
          </p>
        )}
        {!error && <div className='flex-1'></div>}{' '}
        {/* Placeholder to maintain layout */}
        <Label className='text-sm font-medium'>Total:</Label>
        <span
          className={cn(
            'w-[45px] text-right text-sm font-semibold', // Added width and text-align
            totalWeight > 100 || (error && totalWeight !== 100) // Highlight red if > 100 or if error is set and not 100
              ? 'text-red-600 dark:text-red-400'
              : totalWeight === 100
                ? 'text-green-600 dark:text-green-400' // Highlight green if exactly 100
                : ''
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
          disabled={isSubmitting}
        />
      </div>

      <div className='flex items-center space-x-2'>
        <Checkbox
          id='attribution'
          checked={addAttribution}
          onCheckedChange={(checked) => setAddAttribution(!!checked)}
          disabled={isSubmitting}
        />
        <Label
          htmlFor='attribution'
          className='cursor-pointer text-xs text-neutral-600 dark:text-neutral-400'
        >
          Append &quot;voted via proposals.app&quot; to the reason
        </Label>
      </div>

      <DialogFooter>
        <DialogClose asChild>
          <Button type='button' variant='outline' onClick={onClose}>
            Cancel
          </Button>
        </DialogClose>
        <Button
          type='button'
          onClick={handleSubmit}
          disabled={isSubmitDisabled}
        >
          {isSubmitting ? 'Submitting...' : 'Submit Vote'}
        </Button>
      </DialogFooter>
    </div>
  );
}
