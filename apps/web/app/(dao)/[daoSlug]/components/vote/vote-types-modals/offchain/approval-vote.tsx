'use client';

import * as React from 'react';
import snapshot from '@snapshot-labs/snapshot.js';
import { clientToWeb3Provider } from '@/lib/wallet/adapters';
import { useAccount, useWalletClient } from 'wagmi';
import { Button } from '@/app/components/ui/button';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Textarea } from '@/app/components/ui/textarea';
import { Label } from '@/app/components/ui/label';
import { DialogClose, DialogFooter } from '@/app/components/ui/dialog';
import { toast } from 'sonner';
import {
  type VoteModalContentProps,
  ATTRIBUTION_TEXT,
  SNAPSHOT_APP_NAME,
} from '../../vote-button';

export function OffchainApprovalVoteModalContent({
  proposal,
  snapshotSpace,
  snapshotHubUrl,
  choices,
  onVoteSubmit,
  onClose,
}: VoteModalContentProps) {
  const [selectedChoices, setSelectedChoices] = React.useState<number[]>([]);
  const [reason, setReason] = React.useState('');
  const [addAttribution, setAddAttribution] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const { data: walletClient } = useWalletClient();
  const { address } = useAccount();

  const handleCheckboxChange = (choiceIndex: number, checked: boolean) => {
    setSelectedChoices((prev) =>
      checked
        ? [...prev, choiceIndex + 1] // Snapshot uses 1-based indexing
        : prev.filter((index) => index !== choiceIndex + 1)
    );
  };

  const handleSubmit = async () => {
    if (!walletClient || !address || selectedChoices.length === 0) {
      toast.error('Wallet not connected or no choice selected.', {
        position: 'top-right',
      });
      return;
    }

    setIsSubmitting(true);
    const client = new snapshot.Client712(snapshotHubUrl);

    // Construct final reason
    const finalReason = addAttribution
      ? reason.trim()
        ? `${reason.trim()}\n${ATTRIBUTION_TEXT}`
        : ATTRIBUTION_TEXT.trim() // Use only attribution if reason is empty
      : reason;

    try {
      const web3Provider = clientToWeb3Provider(walletClient);

      const receipt = await client.vote(web3Provider, address, {
        space: snapshotSpace ?? '',
        proposal: proposal.externalId, // Use externalId for Snapshot
        type: 'approval',
        choice: selectedChoices,
        reason: finalReason,
        app: SNAPSHOT_APP_NAME,
      });

      console.log('Snapshot vote receipt:', receipt);
      toast.success('Vote submitted successfully!', { position: 'top-right' });
      await onVoteSubmit(); // Notify parent of success
    } catch (error: unknown) {
      console.error('Failed to submit approval vote via Snapshot:', error);
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
      toast.error(`Failed to submit vote: ${message}`, {
        position: 'top-right',
      });
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
                disabled={isSubmitting}
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
          disabled={
            isSubmitting || selectedChoices.length === 0 || !walletClient
          }
        >
          {isSubmitting ? 'Submitting...' : 'Submit Vote'}
        </Button>
      </DialogFooter>
    </div>
  );
}
