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
  useSimulateContract,
} from 'wagmi';
import { parseUnits } from 'viem'; // Use parseUnits if converting from human-readable, or just BigInt if converting string ID
import {
  ARBITRUM_TREASURY_GOVERNOR_ABI,
  ARBITRUM_CORE_GOVERNOR_ABI,
  ARBITRUM_TREASURY_GOVERNOR_ADDRESS,
  ARBITRUM_CORE_GOVERNOR_ADDRESS,
} from '@/lib/constants';

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

// Standard OpenZeppelin Governor support types: 0=Against, 1=For, 2=Abstain
// Assuming choices array is ordered ["For", "Against", "Abstain"]
const supportMapping: { [key: string]: number } = {
  '1': 1, // Maps choice index + 1 '1' (corresponding to "For") to support type 1 (For)
  '2': 0, // Maps choice index + 1 '2' (corresponding to "Against") to support type 0 (Against)
  '3': 2, // Maps choice index + 1 '3' (corresponding to "Abstain") to support type 2 (Abstain)
};

export function OnchainBasicVoteModalContent({
  proposal,
  choices,
  governorAddress,
  onClose,
}: OnchainBasicVoteModalContentProps) {
  const { address: account } = useAccount();
  const [selectedChoice, setSelectedChoice] = React.useState<string>('');
  const [reason, setReason] = React.useState('');
  const [voteError, setVoteError] = React.useState<string | null>(null);

  // Determine the correct ABI based on the governor address
  const governorAbi =
    governorAddress === ARBITRUM_TREASURY_GOVERNOR_ADDRESS
      ? ARBITRUM_TREASURY_GOVERNOR_ABI
      : governorAddress === ARBITRUM_CORE_GOVERNOR_ADDRESS
        ? ARBITRUM_CORE_GOVERNOR_ABI
        : undefined;

  const selectedSupport = selectedChoice
    ? supportMapping[selectedChoice]
    : undefined;

  // --- Simulation Hook ---
  // Simulate the transaction to estimate gas and check for errors before sending
  const {
    data: simulateData,
    error: simulateError,
    isLoading: isSimulating,
  } = useSimulateContract({
    address: governorAddress as `0x${string}` | undefined,
    abi: governorAbi,
    functionName: 'castVoteWithReason',
    args:
      selectedSupport !== undefined
        ? [BigInt(proposal.externalId), selectedSupport, reason]
        : undefined,
    account,
    // Enable simulation only when required parameters are available
    query: {
      // `enabled` must be inside the `query` property
      enabled: !!(
        governorAddress &&
        governorAbi &&
        account &&
        selectedChoice !== '' &&
        selectedSupport !== undefined
      ),
    },
  });

  // --- Write Hook ---
  const {
    data: hash,
    writeContract,
    isPending: isWritePending,
    error: writeError,
  } = useWriteContract();

  // --- Wait For Receipt Hook ---
  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: confirmError,
  } = useWaitForTransactionReceipt({
    hash,
  });

  // Combined submitting state: simulation, writing, or confirming
  const isSubmitting = isSimulating || isWritePending || isConfirming;

  // Effect to handle transaction success and close modal, and display errors
  React.useEffect(() => {
    if (isConfirmed) {
      setVoteError(null); // Clear any previous error
      onClose(); // Close the modal on successful confirmation
    }
  }, [isConfirmed, onClose]);

  // Effect to handle errors from any stage (simulate, write, confirm)
  React.useEffect(() => {
    if (simulateError) {
      setVoteError(
        `Simulation failed: ${simulateError.message || 'An unknown simulation error occurred.'}`
      );
    } else if (writeError) {
      setVoteError(
        `Transaction failed: ${writeError.message || 'An unknown write error occurred.'}`
      );
    } else if (confirmError) {
      setVoteError(
        `Transaction confirmation failed: ${confirmError.message || 'An unknown confirmation error occurred.'}`
      );
    } else {
      // Clear error if everything is proceeding correctly or reset
      setVoteError(null);
    }
  }, [simulateError, writeError, confirmError]);

  const handleSubmit = async () => {
    // Errors are now primarily handled by the useEffect watching hook errors,
    // but we can add basic checks here before initiating anything if needed.
    // The simulate hook's 'enabled' prop handles most of the input validation checks
    // for the simulation itself.

    if (!simulateData?.request) {
      // This case should ideally be prevented by the button's disabled state,
      // but as a safeguard:
      if (simulateError) {
        // Error is already set by the effect watching simulateError
        return;
      }
      setVoteError(
        'Transaction simulation not ready or failed. Please check inputs.'
      );
      return;
    }

    try {
      // Use the request object from the simulation result, which includes estimated gas
      writeContract(simulateData.request);
    } catch (error) {
      console.error('Failed to initiate basic vote transaction:', error);
      // Wagmi errors are often handled by the hook's `error` state, but this catches errors before `writeContract` is fully triggered
      setVoteError('Failed to prepare transaction. See console for details.');
    }
  };

  // Determine button text based on state
  const buttonText = isSimulating
    ? 'Simulating...'
    : isWritePending
      ? 'Confirming...' // Wallet confirmation
      : isConfirming
        ? 'Submitting...' // Waiting for block confirmation
        : simulateError // If simulation failed, allow retry assuming inputs are fixed
          ? 'Retry Submit'
          : 'Submit Vote'; // Default state

  // Determine button disabled state
  // Disable if submitting at any stage (simulating, writing, confirming)
  // Disable if no choice is selected
  // Disable if governor info or account is missing
  // Disable if simulation data is not available AND there is no simulation error (meaning simulation hasn't finished successfully yet)
  const isSubmitDisabled =
    isSubmitting ||
    !selectedChoice ||
    !governorAbi ||
    !account ||
    (!simulateData?.request && !simulateError); // Enable button to retry if simulateError exists

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
          disabled={isSubmitting} // Disable choices while submitting
        >
          {/* Map choices to RadioGroup items, value is 1-based index */}
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
          disabled={isSubmitting} // Disable textarea while submitting
        />
      </div>

      {/* Display errors from simulation, write, or confirm */}
      {voteError && (
        <p className='text-sm text-red-500 dark:text-red-400'>{voteError}</p>
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
