'use client';

import { useState } from 'react';
import { useCompletion } from '@ai-sdk/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  MessageSquareWarning,
  Sparkles,
} from 'lucide-react';

export default function AISummary({ groupId }: { groupId: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  const { completion, complete, error, isLoading } = useCompletion({
    api: '/api/summary',
    onFinish: () => {
      setShowDisclaimer(true); // Show disclaimer after successful completion
    },
  });

  const toggleExpand = async () => {
    const nextExpandedState = !isExpanded;
    setIsExpanded(nextExpandedState);

    if (nextExpandedState && !isLoading && !completion) {
      if (!groupId) {
        console.error('groupId is missing. Cannot generate summary.');
        return;
      }

      try {
        await complete(groupId);
      } catch (err) {
        console.error('Error initiating completion:', err);
      }
    }
  };

  const showContentArea = isExpanded || isLoading;
  const activelyLoading = isLoading && !completion && !error;

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
        role='button'
        tabIndex={0}
        onKeyDown={(e) =>
          (e.key === 'Enter' || e.key === ' ') && toggleExpand()
        }
      >
        <h3 className='text-base leading-6 font-semibold text-neutral-900 sm:text-lg dark:text-neutral-100'>
          AI-Generated Summary
        </h3>
        <button
          className='-m-1 p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200'
          aria-expanded={isExpanded}
          aria-controls='ai-summary-content'
          aria-label={isExpanded ? 'Collapse summary' : 'Expand summary'}
          onClick={(e) => {
            e.stopPropagation();
            toggleExpand();
          }}
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
        <div id='ai-summary-content' className='space-y-4 px-4 py-5 sm:p-6'>
          {/* Loading State */}
          {activelyLoading && (
            <div className='flex animate-pulse items-center justify-center space-x-2 text-neutral-500 dark:text-neutral-400'>
              <Sparkles />
              <span>Generating...</span>
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <div className='border border-red-400 bg-red-100 p-3 text-sm text-red-700 dark:border-red-600 dark:bg-red-900/20 dark:text-red-300'>
              <p>
                <strong>Error:</strong>{' '}
                {error.message || 'Failed to generate summary.'}
              </p>
            </div>
          )}

          {/* Completion Result & Disclaimer Wrapper */}
          {completion && (
            <div className='space-y-4'>
              {/* Completion Text */}
              <div className='prose prose-neutral dark:prose-invert max-w-none'>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {completion}
                </ReactMarkdown>
              </div>

              {/* AI Disclaimer Warning - Fades in *after* loading stops */}
              <div
                className={`flex items-start border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800 transition-opacity duration-500 ease-in-out dark:border-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300 ${
                  showDisclaimer ? 'opacity-100' : 'opacity-0'
                }`}
                aria-live='polite'
              >
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
            </div>
          )}

          {/* Message if generation attempted but failed due to missing groupId */}
          {!isLoading && !completion && !error && !groupId && (
            <p className='text-sm text-neutral-500 dark:text-neutral-400'>
              Cannot generate summary: Group ID is missing.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
