'use client';

import { useState } from 'react';
import { useCompletion } from '@ai-sdk/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function AISummary({ groupId }: { groupId: string }) {
  const [isLoading, setIsLoading] = useState(false); // Track loading state locally

  const { completion, complete, error, stop } = useCompletion({
    api: '/api/summary',
    // Optional: Handle errors from the API hook
    onError: (err) => {
      console.error('AI Completion Error:', err);
      setIsLoading(false); // Ensure loading state is reset on error
      // You could also set an error message state here to display in the UI
    },
    // Optional: Handle successful completion
    onFinish: () => {
      setIsLoading(false);
    },
  });

  const handleGenerateClick = async () => {
    if (isLoading) return; // Prevent multiple clicks while loading

    if (!groupId) {
      alert('groupId is missing. Check your props or URL parameters.');
      return;
    }

    setIsLoading(true);
    // Clear previous completion and errors if desired
    // (useCompletion might handle this partly, but explicit state helps)
    // Note: `complete` itself likely replaces the `completion` state automatically.

    try {
      // Start the completion request
      await complete(groupId);
      // onFinish callback will set isLoading to false
    } catch (err) {
      // Catch potential synchronous errors during the *initiation*
      // Although most errors will likely be caught by `onError`
      console.error('Error initiating completion:', err);
      setIsLoading(false);
    }
  };

  return (
    <div className='w-full space-y-4'>
      {/* Added padding, vertical spacing, max-width, centering */}
      <div>
        <button
          onClick={handleGenerateClick}
          disabled={isLoading}
          className={`px-4 py-2 font-semibold text-white transition-colors duration-200 ease-in-out ${
            isLoading
              ? 'cursor-not-allowed bg-gray-400'
              : 'bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none'
          } `}
        >
          {isLoading ? 'Generating...' : 'Generate Summary'}
        </button>
      </div>
      {/* Display Error State */}
      {error && (
        <div className='border border-red-400 bg-red-100 p-3 text-red-700'>
          <p>
            <strong>Error:</strong>{' '}
            {error.message || 'Failed to generate summary.'}
          </p>
        </div>
      )}
      {/* Display Completion Result */}
      {/* Add a min-height and border for visual structure, even when empty or loading */}

      {isLoading && !completion && (
        <p className='animate-pulse'>Generating summary...</p>
      )}
      {completion && (
        <div className='prose max-w-none'>
          {/* Apply typography styles */}
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {completion}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}
