'use client';

import { useState } from 'react';
import { useCompletion } from '@ai-sdk/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  MessageSquareWarning,
  Loader2, // Using lucide-react loader icon
} from 'lucide-react';

// Define fade-in animation using Tailwind (add to your globals.css or component style)
// You might need to adjust your tailwind.config.js keyframes/animations if using this approach
/*
In your globals.css (or equivalent):

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer utilities {
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  .animate-fade-in {
    animation: fadeIn 0.5s ease-in-out forwards;
  }
}
*/

export default function AISummary({ groupId }: { groupId: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasAttemptedGeneration, setHasAttemptedGeneration] = useState(false);

  const { completion, complete, error, isLoading } = useCompletion({
    api: '/api/summary',
    onError: (err) => {
      console.error('AI Completion Error:', err);
      setIsExpanded(true);
      // Optional: allow retry after error on next expand
      // setHasAttemptedGeneration(false);
    },
    onFinish: () => {
      setIsExpanded(true);
    },
  });

  const toggleExpand = async () => {
    const nextExpandedState = !isExpanded;
    setIsExpanded(nextExpandedState);

    if (
      nextExpandedState &&
      !isLoading &&
      !completion &&
      !hasAttemptedGeneration
    ) {
      if (!groupId) {
        console.error('groupId is missing. Cannot generate summary.');
        setHasAttemptedGeneration(true); // Mark attempt even if failed due to missing ID
        return;
      }

      setHasAttemptedGeneration(true);
      try {
        complete(groupId);
      } catch (err) {
        console.error('Error initiating completion:', err);
        setIsExpanded(true);
        setHasAttemptedGeneration(false); // Allow retry if initiation failed
      }
    }
  };

  // Show content area if expanded, or if loading (to show the loader)
  const showContentArea = isExpanded || isLoading;
  // Determine if content (completion or error) exists to decide when to show disclaimer/results
  const hasContent = Boolean(completion || error);
  // Determine if we are *actively* loading (for the loader specifically)
  const activelyLoading = isLoading && !hasContent; // Show loader only if loading AND no content/error yet shown

  return (
    <div className='w-full overflow-hidden border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950'>
      {/* Header Section */}
      <div
        className={`flex cursor-pointer items-center justify-between px-4 py-3 sm:px-6 ${
          showContentArea
            ? 'border-b border-neutral-200 dark:border-neutral-800'
            : ''
        }`}
        onClick={toggleExpand}
      >
        <h3 className='text-base leading-6 font-semibold text-neutral-900 sm:text-lg dark:text-neutral-100'>
          AI-Generated Summary
        </h3>
        <button
          className='p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 focus:ring-2 focus:ring-blue-500 focus:outline-none focus:ring-inset dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200'
          aria-expanded={isExpanded}
          aria-label={isExpanded ? 'Collapse summary' : 'Expand summary'}
          // Prevent toggle handler running twice if user clicks exactly on the button
          onClick={(e) => e.stopPropagation()}
          onMouseDown={toggleExpand} // Trigger on mouse down for responsiveness
        >
          {isExpanded ? (
            <ChevronUpIcon className='h-5 w-5' aria-hidden='true' />
          ) : (
            <ChevronDownIcon className='h-5 w-5' aria-hidden='true' />
          )}
        </button>
      </div>

      {/* Collapsible Content Section */}
      {showContentArea && (
        <div className='space-y-4 px-4 py-5 sm:p-6'>
          {/* Loading State - Fades out */}
          <div
            className={`transition-opacity duration-300 ease-in-out ${
              activelyLoading
                ? 'opacity-100'
                : 'pointer-events-none h-0 opacity-0' // Hide smoothly and remove from layout
            }`}
          >
            {activelyLoading && ( // Conditionally render inner content to avoid layout shifts
              <div className='flex items-center justify-center space-x-2 text-neutral-500 dark:text-neutral-400'>
                <Loader2 className='h-4 w-4 animate-spin' />
                <span>Generating summary...</span>
              </div>
            )}
          </div>

          {/* Error State - Appears if error exists and not loading */}
          {/* Added transition for smoother appearance */}
          <div
            className={`transition-opacity duration-300 ease-in-out ${error && !isLoading ? 'opacity-100' : 'pointer-events-none h-0 opacity-0'}`}
          >
            {error && !isLoading && (
              <div className='border border-red-400 bg-red-100 p-3 text-sm text-red-700 dark:border-red-600 dark:bg-red-900/20 dark:text-red-300'>
                <p>
                  <strong>Error:</strong>{' '}
                  {error.message || 'Failed to generate summary.'}
                </p>
              </div>
            )}
          </div>

          {/* Completion Result & Disclaimer Wrapper - Fades in together */}
          {/* Apply fade-in animation class when completion has content */}
          <div
            className={`space-y-4 ${completion ? 'animate-fade-in' : 'opacity-0'}`}
          >
            {completion && (
              <>
                {/* Completion Text */}
                <div className='prose prose-neutral prose-sm sm:prose-base dark:prose-invert max-w-none'>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {completion}
                  </ReactMarkdown>
                </div>

                {/* AI Disclaimer Warning - Show after completion appears and loading stops */}
                {!isLoading && (
                  <div className='flex items-start border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300'>
                    <MessageSquareWarning
                      className='mr-2 h-5 w-5 flex-shrink-0 text-yellow-400 dark:text-yellow-500'
                      aria-hidden='true'
                    />
                    <span>
                      <strong>Disclaimer:</strong> AI-generated content may
                      contain inaccuracies or omissions. Please verify important
                      information independently.
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Message if generation attempted but failed due to missing groupId */}
          {!isLoading &&
            !completion &&
            !error &&
            hasAttemptedGeneration &&
            !groupId && (
              <p className='animate-fade-in text-sm text-neutral-500 dark:text-neutral-400'>
                Cannot generate summary: Group ID is missing.
              </p>
            )}
        </div>
      )}
    </div>
  );
}
