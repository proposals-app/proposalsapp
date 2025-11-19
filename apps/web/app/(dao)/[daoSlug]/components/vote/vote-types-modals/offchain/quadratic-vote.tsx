'use client';

// NOTE: Snapshot's standard Quadratic Voting UI often simplifies to single-choice
// selection, as the quadratic calculation happens based on the voter's VP, not
// user-inputted "credits". This implementation reflects that common pattern.

import * as React from 'react';
import snapshot from '@snapshot-labs/snapshot.js';
import { clientToWeb3Provider } from '@/lib/wallet/adapters';
import { useAccount, useWalletClient } from 'wagmi';
import { Button } from '@/app/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/app/components/ui/radio-group';
import { Textarea } from '@/app/components/ui/textarea';
import { Label } from '@/app/components/ui/label';
import { Checkbox } from '@/app/components/ui/checkbox';
import { DialogClose, DialogFooter } from '@/app/components/ui/dialog';
import { toast } from 'sonner';
import {
  type VoteModalContentProps,
  ATTRIBUTION_TEXT,
  SNAPSHOT_APP_NAME,
} from '../../vote-button';

export function OffchainQuadraticVoteModalContent({
  proposal,
  snapshotSpace,
  snapshotHubUrl,
  choices,
  onVoteSubmit,
  onClose,
}: VoteModalContentProps) {
  // Assuming single choice selection for simplicity, mirroring 'basic' vote UI
  const [selectedChoice, setSelectedChoice] = React.useState<string>('');
  const [reason, setReason] = React.useState('');
  const [addAttribution, setAddAttribution] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const { data: walletClient } = useWalletClient();
  const { address } = useAccount();

  const handleSubmit = async () => {
    if (!walletClient || !address || !selectedChoice) {
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

      // The backend/snapshot client handles the sqrt(vp) calculation.
      // We just send the selected choice index (1-based).
      // Snapshot expects the choice as an object for quadratic, even if only one is selected
      const voteChoice = { [selectedChoice]: 1 };

      const receipt = await client.vote(web3Provider, address, {
        space: snapshotSpace ?? '',
        proposal: proposal.externalId, // Use externalId for Snapshot
        type: 'quadratic', // Snapshot type for quadratic
        choice: voteChoice, // Send object like { "1": 1 } or { "2": 1 }
        reason: finalReason,
        app: SNAPSHOT_APP_NAME,
      });

      console.log('Snapshot vote receipt:', receipt);
      toast.success('Vote submitted successfully!', { position: 'top-right' });
      await onVoteSubmit(); // Notify parent of success
    } catch (error: unknown) {
      console.error('Failed to submit quadratic vote via Snapshot:', error);
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
        <Label className='text-base font-semibold'>Select Choice</Label>
        <p className='text-sm text-neutral-500 dark:text-neutral-400'>
          Select one option. Your vote&apos;s influence will be calculated
          quadratically based on your voting power.
        </p>
        <RadioGroup
          value={selectedChoice}
          onValueChange={setSelectedChoice}
          className='space-y-2 pt-2'
          disabled={isSubmitting}
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
          disabled={isSubmitting || !selectedChoice || !walletClient}
        >
          {isSubmitting ? 'Submitting...' : 'Submit Vote'}
        </Button>
      </DialogFooter>
    </div>
  );
}
