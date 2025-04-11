'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import snapshot from '@snapshot-labs/snapshot.js';
import { Web3Provider } from '@ethersproject/providers';
import { useAccount, useWalletClient } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Selectable, Proposal } from '@proposalsapp/db-indexer';
import { GripVertical } from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  UniqueIdentifier,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { cva } from 'class-variance-authority';
import { toast } from 'sonner';
import { ATTRIBUTION_TEXT, SNAPSHOT_APP_NAME } from '../../vote-button';

// Interface for state items, ensuring 'id' is UniqueIdentifier (string | number)
interface RankedChoiceItem {
  id: UniqueIdentifier; // Use UniqueIdentifier for dnd-kit compatibility
  content: string;
}

interface OffchainRankedChoiceVoteModalContentProps {
  proposal: Selectable<Proposal>;
  snapshotSpace?: string;
  snapshotHubUrl?: string;
  governorAddress?: string;
  choices: string[];
  onVoteSubmit: () => Promise<void>; // Simplified: Parent handles success
  onClose: () => void;
}

function RankedChoiceSortableItem({
  item,
  index,
  isOverlay,
}: {
  item: RankedChoiceItem;
  index: number;
  isOverlay?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const variants = cva(
    'flex items-center space-x-2 rounded border p-2 transition-shadow duration-150 ease-in-out',
    {
      variants: {
        dragging: {
          over: 'ring-2 opacity-30 ring-blue-500 dark:ring-blue-400', // Style when being dragged over
          overlay:
            'ring-2 ring-blue-500 bg-white shadow-lg dark:border-blue-400 dark:bg-neutral-800', // Style for the drag overlay
          default:
            'border-neutral-200 bg-neutral-100 hover:bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:bg-neutral-700/80', // Default and hover style with visible border
        },
      },
    }
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        variants({
          dragging: isOverlay ? 'overlay' : isDragging ? 'over' : 'default',
        })
      )}
    >
      {/* Use explicit drag handle */}
      <Button
        variant={'ghost'}
        {...attributes}
        {...listeners}
        className='-ml-2 h-auto cursor-grab touch-none p-1 text-neutral-400 hover:bg-neutral-300 hover:text-neutral-700 dark:hover:bg-neutral-700 dark:hover:text-neutral-200'
        aria-label={`Drag ${item.content}`}
      >
        <span className='sr-only'>Move item</span>
        <GripVertical className='h-4 w-4' />
      </Button>
      <span className='font-medium select-none'>{index + 1}.</span>
      <span className='flex-1 text-sm select-none'>{item.content}</span>
    </div>
  );
}

// Main Modal Content Component
export function OffchainRankedChoiceVoteModalContent({
  proposal,
  snapshotSpace,
  snapshotHubUrl,
  choices,
  onVoteSubmit,
  onClose,
}: OffchainRankedChoiceVoteModalContentProps) {
  const [rankedItems, setRankedItems] = React.useState<RankedChoiceItem[]>([]);
  const [activeItem, setActiveItem] = React.useState<RankedChoiceItem | null>(
    null
  );
  const [reason, setReason] = React.useState('');
  const [addAttribution, setAddAttribution] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const originalChoicesRef = React.useRef(choices);
  const { data: walletClient } = useWalletClient();
  const { address } = useAccount();

  React.useEffect(() => {
    originalChoicesRef.current = choices;
    setRankedItems(
      choices.map((choiceText, index) => ({
        id: `choice-${index}-${choiceText.slice(0, 10)}`, // Use unique ID
        content: choiceText,
      }))
    );
    setReason('');
  }, [choices]); // Rerun effect if choices array itself changes

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), // Require small movement before drag
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }), // Require hold or movement
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const item = rankedItems.find((i) => i.id === active.id);
    setActiveItem(item || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveItem(null);
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setRankedItems((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        // Ensure indices are valid before moving
        if (oldIndex !== -1 && newIndex !== -1) {
          return arrayMove(items, oldIndex, newIndex);
        }
        return items; // Return original items if indices are invalid
      });
    }
  };

  const handleSubmit = async () => {
    if (!walletClient || !address) {
      toast.error('Wallet not connected.', { position: 'top-right' });
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
      // Map the ranked item content back to their original 1-based indices
      const choiceIndices = rankedItems.map((item) => {
        const originalIndex = originalChoicesRef.current.indexOf(item.content);
        return originalIndex + 1; // Convert to 1-based index
      });

      // Validation
      if (choiceIndices.some((index) => index === 0)) {
        throw new Error('Failed to map choices correctly. Found a 0 index.');
      }
      if (choiceIndices.length !== originalChoicesRef.current.length) {
        throw new Error(
          `Choice count mismatch. Expected ${originalChoicesRef.current.length}, got ${choiceIndices.length}.`
        );
      }
      // Check for duplicate indices (shouldn't happen with Set logic in mapping, but good failsafe)
      if (new Set(choiceIndices).size !== choiceIndices.length) {
        throw new Error('Duplicate choice indices detected.');
      }

      const web3Provider = new Web3Provider(
        walletClient.transport,
        walletClient.chain.id
      );

      const receipt = await client.vote(web3Provider, address, {
        space: snapshotSpace ?? '',
        proposal: proposal.externalId, // Use externalId for Snapshot
        type: 'ranked-choice',
        choice: choiceIndices, // Send array of 1-based indices in ranked order
        reason: finalReason,
        app: SNAPSHOT_APP_NAME,
      });

      console.log('Snapshot vote receipt:', receipt);
      toast.success('Vote submitted successfully!', { position: 'top-right' });
      await onVoteSubmit(); // Notify parent of success
    } catch (error: unknown) {
      console.error('Failed to submit ranked-choice vote via Snapshot:', error);
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

  // Prevent rendering before state initialization or if choices are empty
  if (choices.length === 0) {
    return (
      <div className='py-4 text-center text-neutral-500'>
        No choices available for ranking.
      </div>
    );
  }
  if (rankedItems.length === 0 && choices.length > 0) {
    return null; // Or a loading indicator
  }

  const activeItemIndex = activeItem
    ? rankedItems.findIndex((item) => item.id === activeItem.id)
    : -1;

  return (
    // Keep DndContext wrapping only the elements that need it
    <div className='space-y-4 py-4'>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className='space-y-2'>
          <Label className='text-base font-semibold'>Rank Choices</Label>
          <p className='text-sm text-neutral-500 dark:text-neutral-400'>
            Order the options from most preferred (top) to least preferred
            (bottom). Drag and drop to reorder.
          </p>
          <div
            className={cn(
              'space-y-2 rounded-md border border-neutral-200 bg-neutral-50 p-2 dark:border-neutral-700 dark:bg-neutral-900'
            )}
          >
            <SortableContext
              items={rankedItems.map((i) => i.id)}
              strategy={verticalListSortingStrategy}
            >
              {rankedItems.map((item, index) => (
                <RankedChoiceSortableItem
                  key={item.id}
                  item={item}
                  index={index}
                />
              ))}
            </SortableContext>
          </div>
        </div>
        {/* Render DragOverlay outside the normal flow, ensuring it only renders client-side */}
        {typeof document !== 'undefined' &&
          document.body &&
          createPortal(
            <DragOverlay>
              {activeItem ? (
                <RankedChoiceSortableItem
                  item={activeItem}
                  index={activeItemIndex}
                  isOverlay
                />
              ) : null}
            </DragOverlay>,
            document.body
          )}
      </DndContext>

      <div className='space-y-2'>
        <Label
          htmlFor={`reason-${proposal.id}`}
          className='text-base font-semibold'
        >
          Reason (Optional)
        </Label>
        <Textarea
          id={`reason-${proposal.id}`}
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
          disabled={isSubmitting || rankedItems.length === 0 || !walletClient}
        >
          {isSubmitting ? 'Submitting...' : 'Submit Vote'}
        </Button>
      </DialogFooter>
    </div>
  );
}
