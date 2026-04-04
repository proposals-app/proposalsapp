'use client';

import * as React from 'react';
import { Button } from '@/app/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/app/components/ui/radio-group';
import { Textarea } from '@/app/components/ui/textarea';
import { Label } from '@/app/components/ui/label';
import { DialogClose, DialogFooter } from '@/app/components/ui/dialog';
import type { Proposal, Selectable } from '@proposalsapp/db';
import {
  useAccount,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi';
import { Checkbox } from '@/app/components/ui/checkbox';
import { ATTRIBUTION_TEXT } from '../../vote-button';
import type { Abi, Address } from 'abitype';

interface OnchainBasicVoteModalContentProps {
  proposal: Selectable<Proposal>;
  choices: string[];
  governorAddress: Address;
  governorAbi: Abi;
  chainId: number;
  snapshotSpace?: string;
  snapshotHubUrl?: string;
  onVoteSubmit: (_voteData: {
    proposalId: string;
    choice: number;
    reason: string;
  }) => Promise<void>;
  onClose: () => void;
}

const supportMapping: { [key: string]: number } = {
  For: 1,
  Against: 0,
  Abstain: 2,
};

export function OnchainBasicVoteModalContent({
  proposal,
  choices,
  governorAddress,
  governorAbi,
  chainId,
  onClose,
}: OnchainBasicVoteModalContentProps) {
  const { address: account } = useAccount();
  const [selectedChoice, setSelectedChoice] = React.useState<string>('');
  const [reason, setReason] = React.useState('');
  const [addAttribution, setAddAttribution] = React.useState(true);
  const [voteError, setVoteError] = React.useState<string | null>(null);
  const [hasHandledSuccess, setHasHandledSuccess] = React.useState(false);

  const selectedSupport = supportMapping[selectedChoice];

  const {
    data: hash,
    writeContract,
    isPending: isWritePending,
    error: writeError,
  } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: confirmError,
  } = useWaitForTransactionReceipt({
    chainId,
    hash,
  });

  const isSubmitting = isWritePending || isConfirming;

  React.useEffect(() => {
    if (isConfirmed && !hasHandledSuccess) {
      setHasHandledSuccess(true);
      setVoteError(null);
      onClose();
    }
  }, [hasHandledSuccess, isConfirmed, onClose]);

  React.useEffect(() => {
    if (writeError) {
      setVoteError(
        `Transaction failed: ${writeError.message || 'An unknown write error occurred.'}`
      );
    } else if (confirmError) {
      setVoteError(
        `Transaction confirmation failed: ${confirmError.message || 'An unknown confirmation error occurred.'}`
      );
    }
  }, [confirmError, writeError]);

  const handleSubmit = async () => {
    setVoteError(null);

    if (!account) {
      setVoteError('Missing account information.');
      return;
    }

    if (selectedSupport === undefined || proposal?.externalId === undefined) {
      setVoteError(
        'Please select a vote choice and ensure proposal ID exists.'
      );
      return;
    }

    const finalReason = addAttribution
      ? reason.trim()
        ? `${reason.trim()}\n${ATTRIBUTION_TEXT.trim()}`
        : ATTRIBUTION_TEXT.trim()
      : reason.trim();

    const useCastVoteWithReason = finalReason !== '';
    const functionName = useCastVoteWithReason
      ? 'castVoteWithReason'
      : 'castVote';
    const args: readonly unknown[] = useCastVoteWithReason
      ? [BigInt(proposal.externalId), selectedSupport, finalReason]
      : [BigInt(proposal.externalId), selectedSupport];

    try {
      writeContract({
        address: governorAddress,
        abi: governorAbi,
        chainId,
        functionName,
        args,
      });
    } catch (error) {
      console.error('Error during transaction initiation:', error);
      setVoteError(
        `Transaction initiation failed: ${error instanceof Error ? error.message : 'An unknown error occurred.'}`
      );
    }
  };

  const buttonText = isWritePending
    ? 'Confirming...'
    : isConfirming
      ? 'Submitting...'
      : voteError
        ? 'Retry Submit'
        : 'Submit Vote';

  const isSubmitDisabled =
    isSubmitting ||
    selectedChoice === '' ||
    selectedSupport === undefined ||
    !account ||
    !proposal?.externalId;

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
          disabled={isSubmitting}
        >
          {choices.map((choice, index) => (
            <div key={index} className='flex items-center space-x-2'>
              <RadioGroupItem value={choice} id={`choice-${index}`} />
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

      {voteError && (
        <p className='break-all text-sm text-red-500 dark:text-red-400'>
          {voteError}
        </p>
      )}

      <DialogFooter>
        <DialogClose asChild>
          <Button type='button' variant='outline' disabled={isSubmitting}>
            Cancel
          </Button>
        </DialogClose>
        <Button
          type='button'
          onClick={handleSubmit}
          disabled={isSubmitDisabled}
        >
          {buttonText}
        </Button>
      </DialogFooter>
    </div>
  );
}
