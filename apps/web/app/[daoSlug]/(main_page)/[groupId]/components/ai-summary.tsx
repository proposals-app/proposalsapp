'use client';

import { useState } from 'react';
import { useCompletion } from '@ai-sdk/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  MessageSquareWarning,
} from 'lucide-react';

export default function AISummary({ groupId }: { groupId: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  // Track if we've *attempted* generation to prevent re-triggering on every expand
  const [hasAttemptedGeneration, setHasAttemptedGeneration] = useState(false);

  const { completion, complete, error, isLoading } = useCompletion({
    api: '/api/summary',
    onError: (err) => {
      console.error('AI Completion Error:', err);
      // Ensure expanded on error to show the message
      setIsExpanded(true);
      // Reset attempt flag if you want to allow retrying on next expand after error
      // setHasAttemptedGeneration(false); // Optional: uncomment to allow retry after error
    },
    onFinish: () => {
      // Generation finished (successfully or with error handled by onError)
      // Keep it expanded
      setIsExpanded(true);
    },
  });

  const toggleExpand = async () => {
    const nextExpandedState = !isExpanded;
    setIsExpanded(nextExpandedState);

    // --- Trigger generation logic ---
    // Only generate if:
    // 1. We are expanding (nextExpandedState is true)
    // 2. Generation hasn't been successfully attempted yet (!completion)
    // 3. We are not currently loading (isLoading is false)
    // 4. We haven't already tried and failed *unless* retry logic is enabled (using hasAttemptedGeneration)
    if (
      nextExpandedState &&
      !isLoading &&
      !completion &&
      !hasAttemptedGeneration
    ) {
      if (!groupId) {
        console.error('groupId is missing. Cannot generate summary.');
        // Optionally display an error state specific to missing groupId
        // For now, we just won't trigger the fetch
        return; // Prevent attempt
      }

      setHasAttemptedGeneration(true); // Mark that we are trying/have tried
      try {
        // No need to await here, let the hook manage the background process
        complete(groupId);
        // Loading state is now handled by the hook's `isLoading`
      } catch (err) {
        // Catch potential sync errors during initiation (less likely for `complete`)
        console.error('Error initiating completion:', err);
        setIsExpanded(true); // Ensure expansion to show error if sync error occurs
        setHasAttemptedGeneration(false); // Allow retry if initiation failed
      }
    }
  };

  // Determine if there's content to show (completion or error) or if loading
  const showContentArea = isExpanded || isLoading; // Keep expanded while loading

  return (
    <div className='w-full overflow-hidden border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-950'>
      {/* Header Section - Always visible */}
      <div
        // Use a button for the entire header for better accessibility if the whole thing is clickable
        // Or keep the explicit chevron button as below
        className={`flex cursor-pointer items-center justify-between px-4 py-3 sm:px-6 ${
          showContentArea
            ? 'border-b border-neutral-200 dark:border-neutral-700'
            : ''
        }`}
        onClick={toggleExpand} // Make header clickable to toggle
      >
        <h3 className='text-lg leading-6 font-semibold text-neutral-900 dark:text-neutral-100'>
          AI-Generated Summary
        </h3>
        {/* Toggle Button - Always visible */}
        <button
          // onClick={toggleExpand} // Already handled by the parent div onClick
          className='rounded-md p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 focus:ring-2 focus:ring-blue-500 focus:outline-none focus:ring-inset dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-200'
          aria-expanded={isExpanded}
          aria-label={isExpanded ? 'Collapse summary' : 'Expand summary'}
        >
          {isExpanded ? (
            <ChevronUpIcon className='h-5 w-5' aria-hidden='true' />
          ) : (
            <ChevronDownIcon className='h-5 w-5' aria-hidden='true' />
          )}
        </button>
      </div>

      {/* Collapsible Content Section - Render based on isExpanded */}
      {/* Use conditional rendering (&&) or a CSS transition library for smoother expand/collapse */}
      {showContentArea && (
        <div className='space-y-4 px-4 py-5 sm:p-6'>
          {/* AI Disclaimer Warning - Show once content starts loading or exists */}

          {/* Loading State */}
          {isLoading && completion.length == 0 && (
            <div className='flex animate-pulse items-center justify-center space-x-2 text-neutral-500 dark:text-neutral-400'>
              <span>Generating summary...</span>
            </div>
          )}

          {/* Error State */}
          {error &&
            !isLoading &&
            completion.length == 0 && ( // Only show error if not actively loading
              <div className='border border-red-400 bg-red-100 p-3 text-sm text-red-700 dark:border-red-600 dark:bg-red-900/20 dark:text-red-300'>
                <p>
                  <strong>Error:</strong>{' '}
                  {error.message || 'Failed to generate summary.'}
                  {/* Optionally add a manual retry link/button here if desired */}
                </p>
              </div>
            )}

          {/* Completion Result */}
          {completion && ( // Only show completion if not actively loading (avoids brief flash)
            <div className='prose prose-sm sm:prose-base dark:prose-invert max-w-none'>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {completion}
              </ReactMarkdown>
            </div>
          )}

          {completion && !isLoading && (
            <div className='flex items-start border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300'>
              <MessageSquareWarning
                className='mr-2 h-5 w-5 flex-shrink-0 text-yellow-400 dark:text-yellow-500'
                aria-hidden='true'
              />
              <span>
                <strong>Disclaimer:</strong> AI-generated content may contain
                inaccuracies or omissions. Please verify important information
                independently.
              </span>
            </div>
          )}

          {/* Display message if expanded but no groupId prevented generation */}
          {!isLoading &&
            !completion &&
            !error &&
            hasAttemptedGeneration &&
            !groupId && (
              <p className='text-sm text-neutral-500 dark:text-neutral-400'>
                Cannot generate summary: Group ID is missing.
              </p>
            )}
        </div>
      )}
    </div>
  );
}
