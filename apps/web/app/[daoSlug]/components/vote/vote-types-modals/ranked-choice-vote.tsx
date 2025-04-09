import * as React from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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

// Interface for state items, ensuring 'id' is UniqueIdentifier (string | number)
interface RankedChoiceItem {
  id: UniqueIdentifier; // Use UniqueIdentifier for dnd-kit compatibility
  content: string;
}

interface RankedChoiceVoteModalContentProps {
  proposal: Selectable<Proposal>;
  choices: string[];
  onVoteSubmit: (voteData: {
    proposalId: string;
    choice: number[];
    reason: string;
  }) => Promise<void>;
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
            'border-transparent bg-transparent hover:bg-neutral-100 dark:hover:bg-neutral-800/50', // Default and hover style
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
        className='-ml-2 h-auto cursor-grab touch-none p-1 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-700 dark:hover:bg-neutral-700 dark:hover:text-neutral-200'
        aria-label={`Drag ${item.content}`}
      >
        <span className='sr-only'>Move item</span>
        <GripVertical className='h-4 w-4' />
        {/* Changed icon to GripVertical for clearer affordance */}
      </Button>
      <span className='font-medium select-none'>{index + 1}.</span>
      <span className='flex-1 text-sm select-none'>{item.content}</span>
    </div>
  );
}

// Main Modal Content Component
export function RankedChoiceVoteModalContent({
  proposal,
  choices,
  onVoteSubmit,
  onClose,
}: RankedChoiceVoteModalContentProps) {
  const [rankedItems, setRankedItems] = React.useState<RankedChoiceItem[]>([]);
  const [activeItem, setActiveItem] = React.useState<RankedChoiceItem | null>(
    null
  );
  const [reason, setReason] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const originalChoicesRef = React.useRef(choices);

  React.useEffect(() => {
    originalChoicesRef.current = choices;
    setRankedItems(
      choices.map((choiceText, index) => ({
        // Ensure ID is stable and unique. Using index as prefix for extra safety.
        id: `choice-${index}-${choiceText}`,
        content: choiceText,
      }))
    );
    setReason('');
  }, [choices]);

  const sensors = useSensors(
    useSensor(PointerSensor), // Use PointerSensor for combined mouse/touch
    useSensor(TouchSensor), // Redundant with PointerSensor, but sometimes included for clarity
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
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // Map the ranked item content back to their original 1-based indices
      const choiceIndices = rankedItems.map(
        (item) => originalChoicesRef.current.indexOf(item.content) + 1
      );

      // Validation
      if (choiceIndices.some((index) => index === 0)) {
        throw new Error('Failed to map choices correctly.');
      }
      if (choiceIndices.length !== originalChoicesRef.current.length) {
        throw new Error('Choice count mismatch.');
      }

      await onVoteSubmit({
        proposalId: proposal.id,
        choice: choiceIndices,
        reason: reason,
      });
    } catch (error) {
      console.error('Failed to submit ranked-choice vote:', error);
      // TODO: Show error to user
    } finally {
      setIsSubmitting(false);
    }
  };

  // Prevent rendering before state initialization
  if (rankedItems.length === 0 && choices.length > 0) {
    return null; // Or a loading indicator
  }

  const activeItemIndex = activeItem
    ? rankedItems.findIndex((item) => item.id === activeItem.id)
    : -1;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className='space-y-4 py-4'>
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
          />
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
            disabled={isSubmitting || rankedItems.length === 0}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Vote'}
          </Button>
        </DialogFooter>
      </div>
      {/* Render DragOverlay outside the normal flow */}
      {'document' in window &&
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
  );
}
