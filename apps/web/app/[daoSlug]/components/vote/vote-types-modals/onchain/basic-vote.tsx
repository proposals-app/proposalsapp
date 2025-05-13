'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Selectable, Proposal } from '@proposalsapp/db-indexer';
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi';
import {
  ARBITRUM_TREASURY_GOVERNOR_ABI,
  ARBITRUM_CORE_GOVERNOR_ABI,
  ARBITRUM_TREASURY_GOVERNOR_ADDRESS,
  ARBITRUM_CORE_GOVERNOR_ADDRESS,
} from '@/lib/constants';
import { Checkbox } from '@/components/ui/checkbox';
import { ATTRIBUTION_TEXT } from '../../vote-button';
import { Abi } from 'abitype';

interface OnchainBasicVoteModalContentProps {
  proposal: Selectable<Proposal>;
  choices: string[];
  snapshotSpace?: string; // Not used in onchain, but keep interface consistent if desired
  snapshotHubUrl?: string; // Not used in onchain
  governorAddress?: string;
  onVoteSubmit: (voteData: {
    proposalId: string;
    choice: number;
    reason: string;
  }) => Promise<void>;
  onClose: () => void;
}

// Standard OpenZeppelin Governor support types: 0=Against, 1=For, 2=Abstain
// Mapping from choice string to support type
const supportMapping: { [key: string]: number } = {
  For: 1,
  Against: 0,
  Abstain: 2,
};

export function OnchainBasicVoteModalContent({
  proposal,
  choices,
  governorAddress,
  onClose,
}: OnchainBasicVoteModalContentProps) {
  const { address: account } = useAccount();
  // State now stores the actual choice string ("For", "Against", etc.)
  const [selectedChoice, setSelectedChoice] = React.useState<string>('');
  const [reason, setReason] = React.useState('');
  const [addAttribution, setAddAttribution] = React.useState(true); // State for attribution checkbox
  const [voteError, setVoteError] = React.useState<string | null>(null);

  // Determine the correct ABI based on the governor address
  const governorAbi =
    governorAddress === ARBITRUM_TREASURY_GOVERNOR_ADDRESS
      ? ARBITRUM_TREASURY_GOVERNOR_ABI
      : governorAddress === ARBITRUM_CORE_GOVERNOR_ADDRESS
        ? ARBITRUM_CORE_GOVERNOR_ABI
        : undefined;

  // Derive selectedSupport directly from the selected choice string
  const selectedSupport = supportMapping[selectedChoice];

  // --- Write Hook ---
  const {
    data: hash,
    writeContract,
    isPending: isWritePending, // isPending tracks wallet confirmation
    error: writeError,
  } = useWriteContract();

  // --- Wait For Receipt Hook ---
  const {
    isLoading: isConfirming, // isLoading tracks block confirmation
    isSuccess: isConfirmed,
    error: confirmError,
  } = useWaitForTransactionReceipt({
    hash,
  });

  // Combined submitting state: wallet confirmation or block confirmation
  const isSubmitting = isWritePending || isConfirming;

  // Effect to handle transaction success and close modal
  React.useEffect(() => {
    if (isConfirmed) {
      setVoteError(null); // Clear any previous error
      // Call onVoteSubmit if needed, though on-chain might not need a parent callback
      // other than closing the modal. Keeping it available based on interface.
      // if (onVoteSubmit) {
      //   onVoteSubmit(...); // You might want to structure this differently
      // }
      onClose(); // Close the modal on successful confirmation
    }
  }, [isConfirmed, onClose]);

  // Effect to handle errors from write or confirm stages
  React.useEffect(() => {
    if (writeError) {
      setVoteError(
        `Transaction failed: ${writeError.message || 'An unknown write error occurred.'}`
      );
    } else if (confirmError) {
      setVoteError(
        `Transaction confirmation failed: ${confirmError.message || 'An unknown confirmation error occurred.'}`
      );
    } else if (!isSubmitting && voteError) {
      // Clear the error only if no longer submitting and there was a previous error
      // Note: Consider if clearing the error here is always the desired behavior,
      // maybe only clear on explicit user action or successful retry.
      // For now, keeping the logic as it was.
      setVoteError(null);
    }
    // Intentionally keeping voteError out of deps if we only want to set/clear based on new external errors or submission state changes.
    // If you want the effect to re-run whenever voteError itself changes, add it back.
  }, [writeError, confirmError, isSubmitting]);

  const handleSubmit = async () => {
    setVoteError(null); // Clear previous errors on new submission attempt

    // Basic validation
    if (!governorAddress || !governorAbi || !account) {
      setVoteError('Missing required contract or account information.');
      return;
    }
    if (selectedSupport === undefined || proposal?.externalId === undefined) {
      setVoteError(
        'Please select a vote choice and ensure proposal ID exists.'
      );
      return;
    }
    // Redundant check already covered above, keeping for explicitness if desired
    // if (!proposal?.externalId) {
    //   setVoteError('Missing proposal ID.');
    //   return;
    // }

    // Construct the final reason based on input and attribution checkbox
    const finalReason = addAttribution
      ? reason.trim()
        ? `${reason.trim()}\n${ATTRIBUTION_TEXT.trim()}`
        : ATTRIBUTION_TEXT.trim() // Use only attribution if reason is empty
      : reason.trim(); // Use only the provided reason (trimmed)

    // Determine which contract function to call and the arguments
    const useCastVoteWithReason = finalReason !== '';
    const methodName = useCastVoteWithReason
      ? 'castVoteWithReason'
      : 'castVote';
    const methodArgs: readonly unknown[] = useCastVoteWithReason // Explicitly type as readonly unknown[]
      ? [BigInt(proposal.externalId), selectedSupport, finalReason]
      : [BigInt(proposal.externalId), selectedSupport];

    try {
      // Directly trigger the write contract call
      writeContract({
        address: governorAddress as `0x${string}`,
        abi: governorAbi as Abi, // Cast ABI to wagmi's Abi type
        functionName: methodName,
        args: methodArgs, // Pass the correctly typed args array directly
      });
    } catch (error) {
      console.error('Error during transaction initiation:', error);
      setVoteError(
        `Transaction initiation failed: ${error instanceof Error ? error.message : 'An unknown error occurred.'}`
      );
    }
  };

  // Determine button text based on state
  const buttonText = isWritePending
    ? 'Confirming...' // Wallet confirmation
    : isConfirming
      ? 'Submitting...' // Waiting for block confirmation
      : voteError // If there's an error, allow retry
        ? 'Retry Submit'
        : 'Submit Vote'; // Default state

  const isSubmitDisabled =
    isSubmitting ||
    selectedChoice === '' ||
    selectedSupport === undefined ||
    !governorAbi ||
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
          value={selectedChoice} // Use the choice string as the value
          onValueChange={setSelectedChoice} // Set state with the choice string
          className='space-y-2 pt-2'
          disabled={isSubmitting} // Disable choices while submitting
        >
          {/* Map choices to RadioGroup items, value is the choice string */}
          {choices.map((choice, index) => (
            <div key={index} className='flex items-center space-x-2'>
              <RadioGroupItem value={choice} id={`choice-${index}`} />{' '}
              {/* Use choice string as value */}
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
          disabled={isSubmitting} // Disable textarea while submitting
        />
      </div>

      {/* Attribution checkbox */}
      <div className='flex items-center space-x-2'>
        <Checkbox
          id='attribution'
          checked={addAttribution}
          onCheckedChange={(checked) => setAddAttribution(!!checked)}
          disabled={isSubmitting} // Disable checkbox while submitting
        />
        <Label
          htmlFor='attribution'
          className='cursor-pointer text-xs text-neutral-600 dark:text-neutral-400'
        >
          Append &quot;voted via proposals.app&quot; to the reason
        </Label>
      </div>

      {/* Display errors */}
      {voteError && (
        <p className='text-sm break-all text-red-500 dark:text-red-400'>
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
