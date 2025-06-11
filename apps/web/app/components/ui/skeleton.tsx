import * as React from 'react';
import { type VariantProps, cva } from 'class-variance-authority';

import { cn } from '../../../lib/utils';

const skeletonVariants = cva('skeleton-blueprint', {
  variants: {
    variant: {
      default: 'rounded-sm',
      text: 'skeleton-text rounded-none',
      avatar: 'skeleton-solid rounded-full',
      button: 'skeleton-solid rounded-sm',
      card: 'skeleton-solid rounded-sm',
      input: 'rounded-sm',
    },
    size: {
      xs: 'h-3',
      sm: 'h-4',
      md: 'h-5',
      lg: 'h-6',
      xl: 'h-8',
      '2xl': 'h-10',
      '3xl': 'h-12',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'md',
  },
});

interface SkeletonProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof skeletonVariants> {
  width?: string | number;
  height?: string | number;
}

const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, variant, size, width, height, style, ...props }, ref) => {
    const skeletonStyle = {
      ...style,
      ...(width && { width: typeof width === 'number' ? `${width}px` : width }),
      ...(height && {
        height: typeof height === 'number' ? `${height}px` : height,
      }),
    };

    return (
      <div
        ref={ref}
        className={cn(skeletonVariants({ variant, size }), className)}
        style={skeletonStyle}
        {...props}
      />
    );
  }
);
Skeleton.displayName = 'Skeleton';

// Composite skeleton components for common patterns
const SkeletonText = React.forwardRef<
  HTMLDivElement,
  Omit<SkeletonProps, 'variant'> & { lines?: number }
>(({ lines = 1, className, ...props }, ref) => {
  if (lines === 1) {
    return (
      <Skeleton ref={ref} variant='text' className={className} {...props} />
    );
  }

  return (
    <div className='space-y-2'>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          ref={index === 0 ? ref : undefined}
          variant='text'
          className={cn(
            className,
            index === lines - 1 && lines > 1 ? 'w-3/4' : 'w-full'
          )}
          {...props}
        />
      ))}
    </div>
  );
});
SkeletonText.displayName = 'SkeletonText';

const SkeletonAvatar = React.forwardRef<
  HTMLDivElement,
  Omit<SkeletonProps, 'variant'> & { size?: 'sm' | 'md' | 'lg' | 'xl' }
>(({ size = 'md', className, ...props }, ref) => {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  };

  return (
    <Skeleton
      ref={ref}
      variant='avatar'
      className={`${cn(sizeClasses[size], className)} aspect-square`}
      {...props}
    />
  );
});
SkeletonAvatar.displayName = 'SkeletonAvatar';

const SkeletonButton = React.forwardRef<
  HTMLDivElement,
  Omit<SkeletonProps, 'variant'> & { size?: 'sm' | 'md' | 'lg' }
>(({ size = 'md', className, ...props }, ref) => {
  const sizeClasses = {
    sm: 'h-8 w-20',
    md: 'h-9 w-24',
    lg: 'h-10 w-28',
  };

  return (
    <Skeleton
      ref={ref}
      variant='button'
      className={cn(sizeClasses[size], className)}
      {...props}
    />
  );
});
SkeletonButton.displayName = 'SkeletonButton';

const SkeletonCard = React.forwardRef<
  HTMLDivElement,
  Omit<SkeletonProps, 'variant'> & {
    children?: React.ReactNode;
    padding?: boolean;
  }
>(({ children, padding = true, className, ...props }, ref) => {
  return (
    <Skeleton
      ref={ref}
      variant='card'
      className={cn('w-full', padding && 'p-4', className)}
      {...props}
    >
      {children}
    </Skeleton>
  );
});
SkeletonCard.displayName = 'SkeletonCard';

// Common layout patterns
const SkeletonPost = React.forwardRef<HTMLDivElement, { className?: string }>(
  ({ className }, ref) => {
    return (
      <div ref={ref} className={cn('space-y-4', className)}>
        <div className='flex items-center space-x-3'>
          <SkeletonAvatar size='md' />
          <div className='flex-1 space-y-2'>
            <SkeletonText size='sm' width='30%' />
            <SkeletonText size='xs' width='20%' />
          </div>
        </div>
        <div className='space-y-2'>
          <SkeletonText size='lg' width='90%' />
          <SkeletonText lines={3} />
        </div>
        <div className='flex items-center space-x-4'>
          <SkeletonButton size='sm' />
          <SkeletonButton size='sm' />
        </div>
      </div>
    );
  }
);
SkeletonPost.displayName = 'SkeletonPost';

const SkeletonVoteItem = React.forwardRef<
  HTMLDivElement,
  { className?: string; showColorBar?: boolean }
>(({ className, showColorBar = true }, ref) => {
  return (
    <div ref={ref} className={cn('space-y-3', className)}>
      {showColorBar && (
        <div className='skeleton-blueprint skeleton-text h-1 w-full' />
      )}
      <div className='flex items-start justify-between'>
        <div className='flex-1 space-y-2'>
          <SkeletonText size='md' width='75%' />
          <SkeletonText size='sm' width='50%' />
        </div>
        <SkeletonButton size='sm' />
      </div>
      <div className='flex items-center space-x-4'>
        <SkeletonText size='xs' width='15%' />
        <SkeletonText size='xs' width='20%' />
        <SkeletonText size='xs' width='10%' />
      </div>
    </div>
  );
});
SkeletonVoteItem.displayName = 'SkeletonVoteItem';

const SkeletonList = React.forwardRef<
  HTMLDivElement,
  {
    items?: number;
    itemComponent?: React.ComponentType<{ className?: string }>;
    className?: string;
    itemClassName?: string;
  }
>(
  (
    {
      items = 5,
      itemComponent: ItemComponent = SkeletonPost,
      className,
      itemClassName,
    },
    ref
  ) => {
    return (
      <div ref={ref} className={cn('space-y-6', className)}>
        {Array.from({ length: items }).map((_, index) => (
          <ItemComponent key={index} className={itemClassName} />
        ))}
      </div>
    );
  }
);
SkeletonList.displayName = 'SkeletonList';

// Page-level skeleton layouts
const SkeletonMainPage = React.forwardRef<
  HTMLDivElement,
  { className?: string }
>(({ className }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        'flex min-h-screen w-full justify-center bg-neutral-50 dark:bg-neutral-900',
        className
      )}
    >
      <div className='w-full max-w-5xl px-4 py-6 md:px-8 md:py-10'>
        <SkeletonHeader />

        {/* Enhanced Action Bar Skeleton */}
        <div className='flex flex-col items-start justify-between space-y-4 sm:flex-row sm:items-center sm:space-y-0'>
          <SkeletonText width='12rem' size='xl' />
          <SkeletonButton size='md' />
        </div>

        {/* Enhanced Groups List Skeleton */}
        <SkeletonGroupList />
      </div>
    </div>
  );
});
SkeletonMainPage.displayName = 'SkeletonMainPage';

const SkeletonGroupPage = React.forwardRef<
  HTMLDivElement,
  { className?: string }
>(({ className }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        'flex w-full flex-col items-center px-4 md:pt-10 md:pr-96',
        className
      )}
    >
      <div className='flex w-full max-w-3xl flex-col gap-4 overflow-visible'>
        <SkeletonBodyHeader />
        <SkeletonBody />
        <SkeletonMenuBar />
        <SkeletonFeed />
      </div>
    </div>
  );
});
SkeletonGroupPage.displayName = 'SkeletonGroupPage';

const SkeletonResultsPage = React.forwardRef<
  HTMLDivElement,
  { className?: string }
>(({ className }, ref) => {
  return (
    <div
      ref={ref}
      className={cn('flex min-h-screen w-full flex-row', className)}
    >
      <SkeletonResultsHeader />
      <SkeletonTimeline />

      <div className='flex w-full grow -translate-x-[1px] py-2 sm:-translate-y-2 sm:py-28'>
        <div className='h-full w-full pr-2 pl-2 sm:pr-4 sm:pl-0'>
          <div className='dark:border-neutral-650 flex h-full min-h-[calc(100vh-114px)] w-full flex-col rounded-r-xs border border-neutral-800 bg-white p-6 dark:bg-neutral-950'>
            <SkeletonResults />
          </div>
        </div>
      </div>
    </div>
  );
});
SkeletonResultsPage.displayName = 'SkeletonResultsPage';

const SkeletonVPPage = React.forwardRef<HTMLDivElement, { className?: string }>(
  ({ className }, ref) => {
    return (
      <div ref={ref} className={cn('container mx-auto p-4 py-10', className)}>
        <div className='skeleton-blueprint mb-4 h-8 w-1/2 rounded-sm text-center text-2xl font-bold' />
        <SkeletonChart />
      </div>
    );
  }
);
SkeletonVPPage.displayName = 'SkeletonVPPage';

// Header components
const SkeletonHeader = React.forwardRef<HTMLDivElement, { className?: string }>(
  ({ className }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'mb-8 overflow-hidden rounded-xs border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800/50',
          className
        )}
      >
        {/* Mobile layout skeleton */}
        <div className='md:hidden'>
          {/* Header with profile picture */}
          <div className='p-6'>
            <div className='flex flex-row items-center space-x-4'>
              <div className='skeleton-blueprint skeleton-solid relative flex h-12 w-12 items-center justify-center rounded-full p-4 sm:h-16 sm:w-16' />
              <div className='flex-1'>
                <div className='skeleton-blueprint skeleton-text h-6 w-32' />
                <div className='skeleton-blueprint skeleton-text mt-2 h-4 w-32' />
              </div>
            </div>
          </div>

          {/* Primary metrics row */}
          <div className='grid grid-cols-3 border-t border-neutral-200 dark:border-neutral-700'>
            {['Active', 'Proposals', 'Discussions'].map((label) => (
              <div
                key={label}
                className='border-r border-neutral-200 last:border-r-0 dark:border-neutral-700'
              >
                <div className='flex flex-col items-center justify-center bg-white p-4 text-center dark:bg-neutral-800/50'>
                  <div className='skeleton-blueprint skeleton-text mb-1 h-6 w-8' />
                  <div className='skeleton-blueprint skeleton-text h-4 w-12' />
                </div>
              </div>
            ))}
          </div>

          {/* Financial metrics row */}
          <div className='grid grid-cols-3 border-t border-neutral-200 dark:border-neutral-700'>
            {['Token Price', 'Market Cap', 'Treasury'].map((label, _index) => (
              <div
                key={label}
                className='border-r border-neutral-200 last:border-r-0 dark:border-neutral-700'
              >
                <div className='flex flex-col items-center justify-center bg-neutral-50 p-4 dark:bg-neutral-900/20'>
                  <div className='skeleton-blueprint skeleton-text mb-1 h-6 w-10' />
                  <div className='skeleton-blueprint skeleton-text h-4 w-14' />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Desktop layout skeleton */}
        <div className='hidden md:block'>
          <div className='grid grid-cols-5 grid-rows-3'>
            {/* Profile picture, name and description */}
            <div className='col-span-3 row-span-2 p-6'>
              <div className='flex flex-row items-center space-x-8'>
                <div className='skeleton-blueprint skeleton-solid relative flex h-16 w-16 items-center justify-center rounded-full p-4' />
                <div className='flex-1'>
                  <div className='skeleton-blueprint skeleton-text h-8 w-48' />
                  <div className='skeleton-blueprint skeleton-text mt-2 h-4 w-48' />
                </div>
              </div>
            </div>

            {/* Column 4 is empty and auto-adjusts */}
            <div className='col-start-4 col-end-5 row-span-3' />

            {/* Financial metrics in column 5 */}
            {['Token Price', 'Voting Power', 'Treasury'].map((label, index) => (
              <div
                key={label}
                className={`col-start-5 col-end-6 row-start-${index + 1} row-end-${index + 2} border-b border-l border-neutral-200 dark:border-neutral-700 ${index === 2 ? 'border-b-0' : ''}`}
              >
                <div
                  className={`flex flex-col items-center justify-center p-4 ${index % 2 === 0 ? 'bg-neutral-50 dark:bg-neutral-900/20' : 'bg-white dark:bg-neutral-800/50'}`}
                >
                  <div className='skeleton-blueprint skeleton-text mb-1 h-6 w-10' />
                  <div className='skeleton-blueprint skeleton-text h-4 w-14' />
                </div>
              </div>
            ))}

            {/* Primary metrics in row 3, columns 1-3 */}
            {['Active', 'Proposals', 'Discussions'].map((label, index) => (
              <div
                key={label}
                className={`col-start-${index + 1} col-end-${index + 2} row-start-3 row-end-4 border-t border-r border-neutral-200 dark:border-neutral-700`}
              >
                <div
                  className={`flex flex-col items-center justify-center p-4 text-center ${index % 2 === 0 ? 'bg-neutral-50 dark:bg-neutral-900/20' : 'bg-white dark:bg-neutral-800/50'}`}
                >
                  <div className='skeleton-blueprint skeleton-text mb-1 h-6 w-8' />
                  <div className='skeleton-blueprint skeleton-text h-4 w-12' />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
);
SkeletonHeader.displayName = 'SkeletonHeader';

const SkeletonBodyHeader = React.forwardRef<
  HTMLDivElement,
  { className?: string }
>(({ className }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        'flex w-full flex-col-reverse gap-6 sm:flex-col',
        className
      )}
    >
      {/* Title Loading */}
      <div className='skeleton-blueprint skeleton-text h-8 w-3/4 self-center sm:self-start' />

      {/* Author Info and Posted Time Loading */}
      <div className='flex flex-col'>
        <div className='flex flex-row items-start justify-between md:items-center'>
          {/* Author Info Loading */}
          <div className='flex flex-row items-center gap-2'>
            <div className='flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 border-neutral-200 dark:border-neutral-700'>
              <div className='skeleton-blueprint skeleton-solid h-full w-full rounded-full' />
            </div>
            <div className='skeleton-blueprint skeleton-text h-5 w-32' />
          </div>
          {/* Posted Time and Revisions Loading */}
          <div className='flex flex-col items-end gap-2'>
            <div className='flex flex-row gap-4'>
              {/* Initially Posted */}
              <div className='hidden flex-row items-center gap-2 px-2 py-1 sm:flex'>
                <div className='flex flex-col items-end space-y-1'>
                  <div className='skeleton-blueprint skeleton-text h-3 w-24' />
                  <div className='skeleton-blueprint skeleton-text h-4 w-32' />
                </div>
              </div>

              {/* Latest Revision */}
              <div className='flex flex-row items-center gap-2 bg-white px-2 py-1 dark:bg-neutral-950'>
                <div className='flex flex-col items-end space-y-1'>
                  <div className='skeleton-blueprint skeleton-text h-3 w-24' />
                  <div className='skeleton-blueprint skeleton-text h-4 w-32' />
                </div>
                <div className='skeleton-blueprint skeleton-text h-6 w-6' />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
SkeletonBodyHeader.displayName = 'SkeletonBodyHeader';

const SkeletonResultsHeader = React.forwardRef<
  HTMLDivElement,
  { className?: string }
>(({ className }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        'border-neutral-350 dark:border-neutral-650 fixed top-0 right-0 left-0 z-50 flex h-20 items-center border-b bg-neutral-50 px-2 transition-transform duration-300 sm:ml-20 sm:px-6 dark:bg-neutral-900',
        className
      )}
    >
      {/* Back Button Placeholder */}
      <div className='flex items-center gap-2 rounded-full px-3 py-2'>
        <div className='skeleton-blueprint skeleton-text h-6 w-6' />
        <span className='hidden text-sm font-medium sm:block'>Back</span>
      </div>

      <div className='flex items-center gap-2 pl-2 sm:pl-4'>
        {/* Avatar Placeholder */}
        <div className='flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 border-neutral-700 dark:border-neutral-300'>
          <div className='skeleton-blueprint skeleton-solid h-8 w-8 rounded-full' />
        </div>
        {/* Group Name Placeholder */}
        <div className='skeleton-blueprint skeleton-text h-6 w-32' />
      </div>
    </div>
  );
});
SkeletonResultsHeader.displayName = 'SkeletonResultsHeader';

// Body and content components
const SkeletonBody = React.forwardRef<HTMLDivElement, { className?: string }>(
  ({ className }, ref) => {
    return (
      <div ref={ref} className={cn('w-full', className)}>
        <div className='relative overflow-hidden'>
          <div
            className='prose prose-lg max-w-none overflow-hidden p-2 sm:p-6'
            style={{ maxHeight: '25rem' }}
          >
            <div className='space-y-4'>
              {/* Title line */}
              <div className='skeleton-blueprint skeleton-text h-8 w-3/4' />
              {/* Paragraph lines */}
              <div className='skeleton-blueprint skeleton-text h-4 w-full' />
              <div className='skeleton-blueprint skeleton-text h-4 w-11/12' />
              {/* Section Heading */}
              <div className='skeleton-blueprint skeleton-text mt-6 h-6 w-1/2' />
              {/* More Paragraphs */}
              <div className='skeleton-blueprint skeleton-text mt-6 h-4 w-full' />
              <div className='skeleton-blueprint skeleton-text h-4 w-11/12' />
              <div className='skeleton-blueprint skeleton-text mt-4 h-4 w-3/4' />
              <div className='skeleton-blueprint skeleton-text h-4 w-full' />
              <div className='skeleton-blueprint skeleton-text h-4 w-10/12' />
            </div>

            {/* Gradient overlay */}
            <div className='skeleton-blueprint skeleton-text absolute right-0 bottom-0 left-0 h-24 bg-neutral-50/80 dark:bg-neutral-900/80' />
          </div>
        </div>
      </div>
    );
  }
);
SkeletonBody.displayName = 'SkeletonBody';

const SkeletonMenuBar = React.forwardRef<
  HTMLDivElement,
  { className?: string }
>(({ className }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        'font-condensed z-40 flex w-full justify-center',
        className
      )}
    >
      <div className='mt-4 min-w-full self-center overflow-visible px-2 opacity-100 sm:min-w-4xl sm:px-2'>
        <div className='dark:border-neutral-450 flex w-full items-center justify-between gap-2 rounded-xs border-2 border-neutral-800 bg-white fill-neutral-800 p-2 text-sm font-bold text-neutral-800 dark:bg-neutral-950 dark:fill-neutral-200 dark:text-neutral-200'>
          <div className='flex w-full justify-between'>
            <div className='flex items-center gap-4'>
              <div className='skeleton-blueprint skeleton-solid h-6 w-6 rounded-full' />
              <div className='skeleton-blueprint skeleton-text h-5 w-16 sm:w-32' />
            </div>

            <div className='flex space-x-2'>
              <div className='skeleton-blueprint skeleton-text h-8 w-24 sm:w-44' />
              <div className='skeleton-blueprint skeleton-text h-8 w-24 sm:w-44' />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
SkeletonMenuBar.displayName = 'SkeletonMenuBar';

// List and group components
const SkeletonGroupList = React.forwardRef<
  HTMLDivElement,
  { className?: string }
>(({ className }, ref) => {
  return (
    <div ref={ref} className={cn('space-y-4', className)}>
      {Array(24)
        .fill(0)
        .map((_, index) => (
          <SkeletonGroupItem key={index} />
        ))}
    </div>
  );
});
SkeletonGroupList.displayName = 'SkeletonGroupList';

const SkeletonGroupItem = React.forwardRef<
  HTMLDivElement,
  { className?: string }
>(({ className }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        'flex space-x-4 border border-neutral-200 bg-neutral-100 p-4 dark:border-neutral-700 dark:bg-neutral-900',
        className
      )}
    >
      {/* Avatar Skeleton */}
      <SkeletonAvatar size='md' className='sm:h-10 sm:w-10' />

      <div className='flex w-full flex-col justify-center space-y-2'>
        {/* Group Name Skeleton */}
        <SkeletonText width='12rem' size='md' />
        {/* Author Name Skeleton */}
        <SkeletonText width='8rem' size='sm' />
        {/* Meta info line Skeleton */}
        <div className='mt-2 flex flex-wrap gap-2'>
          <SkeletonText width='3rem' size='xs' />
          <SkeletonText width='4rem' size='xs' />
        </div>
      </div>
    </div>
  );
});
SkeletonGroupItem.displayName = 'SkeletonGroupItem';

// Feed components
const SkeletonFeed = React.forwardRef<HTMLDivElement, { className?: string }>(
  ({ className }, ref) => {
    const loadingItems = Array.from({ length: 12 });

    return (
      <div ref={ref} className={cn('flex w-full flex-col gap-8', className)}>
        {loadingItems.map((_, index) => {
          // Alternate between PostItemLoading and VoteItemLoading
          if (index % 3 === 0) {
            return (
              <div
                key={index}
                className='border-b border-neutral-200 py-4 dark:border-neutral-800'
              >
                <SkeletonPostItem />
              </div>
            );
          } else {
            return (
              <div
                key={index}
                className='border-b border-neutral-200 py-4 dark:border-neutral-800'
              >
                <SkeletonVoteItemFeed />
              </div>
            );
          }
        })}
      </div>
    );
  }
);
SkeletonFeed.displayName = 'SkeletonFeed';

const SkeletonPostItem = React.forwardRef<
  HTMLDivElement,
  { className?: string }
>(({ className }, ref) => {
  return (
    <div ref={ref} className={cn('flex w-full flex-col gap-4', className)}>
      <div className='flex items-center gap-4'>
        <div className='skeleton-blueprint skeleton-solid h-10 w-10 rounded-full' />
        <div className='flex flex-col space-y-2'>
          <div className='skeleton-blueprint skeleton-text h-4 w-48 rounded' />
          <div className='skeleton-blueprint skeleton-text h-3 w-32 rounded' />
        </div>
      </div>
      <div className='flex flex-col space-y-2'>
        <div className='skeleton-blueprint skeleton-text h-4 w-full rounded' />
        <div className='skeleton-blueprint skeleton-text h-4 w-5/6 rounded' />
        <div className='skeleton-blueprint skeleton-text h-4 w-3/4 rounded' />
      </div>
      <div className='mt-2 flex justify-end'>
        <div className='skeleton-blueprint skeleton-text h-3 w-20 rounded' />
      </div>
    </div>
  );
});
SkeletonPostItem.displayName = 'SkeletonPostItem';

const SkeletonVoteItemFeed = React.forwardRef<
  HTMLDivElement,
  { className?: string }
>(({ className }, ref) => {
  return (
    <div ref={ref} className={cn('flex w-full flex-col gap-4', className)}>
      <div className='skeleton-blueprint skeleton-text mb-2 h-2 w-full' />
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-4'>
          <div className='skeleton-blueprint skeleton-solid h-10 w-10 rounded-full' />
          <div className='flex flex-col space-y-2'>
            <div className='skeleton-blueprint skeleton-text h-4 w-48 rounded' />
            <div className='skeleton-blueprint skeleton-text h-3 w-32 rounded' />
          </div>
        </div>
        <div className='skeleton-blueprint skeleton-text h-3 w-24 rounded' />
      </div>
      <div className='flex flex-col space-y-2'>
        <div className='skeleton-blueprint skeleton-text h-4 w-1/2 rounded' />
      </div>
      <div className='mt-2 flex justify-end'>
        <div className='skeleton-blueprint skeleton-text h-3 w-20 rounded' />
      </div>
    </div>
  );
});
SkeletonVoteItemFeed.displayName = 'SkeletonVoteItemFeed';

// Results and timeline components
const SkeletonResults = React.forwardRef<
  HTMLDivElement,
  { className?: string }
>(({ className }, ref) => {
  return (
    <div
      ref={ref}
      className={cn('flex w-full flex-col gap-2 sm:flex-row', className)}
    >
      <div className='flex w-full flex-col gap-8 sm:gap-2'>
        <div className='hidden lg:block'>
          <SkeletonResultsTitle />
        </div>

        <div className='flex justify-center sm:hidden'>
          <SkeletonResultsList />
        </div>

        <SkeletonChart />

        <div className='flex flex-col'>
          <SkeletonNonVotersTable />
          <SkeletonResultsTable />
        </div>
      </div>

      <div className='hidden sm:block'>
        <SkeletonResultsList />
      </div>
    </div>
  );
});
SkeletonResults.displayName = 'SkeletonResults';

const SkeletonResultsTitle = React.forwardRef<
  HTMLDivElement,
  { className?: string }
>(({ className }, ref) => {
  return (
    <div ref={ref} className={cn('mb-4 flex flex-col gap-4', className)}>
      {/* Title placeholder */}
      <div className='skeleton-blueprint skeleton-text h-6 w-2/3' />

      {/* Metadata row */}
      <div className='flex items-center gap-4'>
        {/* Published by text */}
        <div className='flex items-center gap-2'>
          <div className='skeleton-blueprint skeleton-text h-3 w-24' />
          <div className='skeleton-blueprint skeleton-text h-3 w-32' />
          <div className='skeleton-blueprint skeleton-text h-3 w-16' />
          <div className='skeleton-blueprint skeleton-text h-3 w-24' />
        </div>
      </div>
    </div>
  );
});
SkeletonResultsTitle.displayName = 'SkeletonResultsTitle';

const SkeletonResultsList = React.forwardRef<
  HTMLDivElement,
  { className?: string }
>(({ className }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        'w-72 text-neutral-700 sm:ml-6 dark:text-neutral-200',
        className
      )}
    >
      {/* Status message placeholder */}
      <div className='flex flex-col justify-center sm:h-28'>
        <div className='skeleton-blueprint skeleton-text mb-1 h-5 w-3/4' />
        <div className='skeleton-blueprint skeleton-text mb-4 h-5 w-3/4' />
      </div>

      {/* Majority support placeholder */}
      <div className='mb-4 flex w-full items-center gap-1'>
        <div className='skeleton-blueprint skeleton-solid h-4 w-4 rounded-full' />
        <div className='skeleton-blueprint skeleton-text h-4 w-24' />
      </div>

      {/* Choice bars loading state */}
      <div className='mb-4 space-y-2'>
        {[...Array(3)].map((_, index) => (
          <div
            key={index}
            className='relative h-10 w-full overflow-hidden rounded border-2 border-neutral-200 dark:border-neutral-700'
          />
        ))}
      </div>

      {/* Quorum bar placeholder */}
      <div className='mb-4'>
        <div className='relative mb-2 h-4 w-full overflow-hidden rounded border border-neutral-200 dark:border-neutral-700'>
          <div className='skeleton-blueprint skeleton-text h-full w-1/2' />
          <div className='absolute top-[-4px] left-1/2 h-6 w-0.5 rounded bg-neutral-300 dark:bg-neutral-600' />
        </div>
      </div>
    </div>
  );
});
SkeletonResultsList.displayName = 'SkeletonResultsList';

const SkeletonResultsTable = React.forwardRef<
  HTMLDivElement,
  { className?: string }
>(({ className }, ref) => {
  const desktopRowHeight = 80;
  return (
    <div ref={ref} className={className}>
      {/* Desktop Header */}
      <div className='skeleton-blueprint sticky top-[88px] z-10 mb-2 hidden h-12 grid-cols-7 items-center gap-2 border border-neutral-800 p-2 sm:grid dark:border-neutral-600'>
        <div className='col-span-2 flex items-center'>
          <div className='skeleton-blueprint skeleton-text h-4 w-full' />
        </div>
        <div className='col-span-1 flex items-center justify-end gap-2'>
          <div className='skeleton-blueprint skeleton-text h-4 w-16' />
        </div>
        <div className='col-span-3'>
          <div className='skeleton-blueprint skeleton-text h-4 w-full' />
        </div>
        <div className='col-span-1 flex items-center justify-end gap-2'>
          <div className='skeleton-blueprint skeleton-text h-4 w-24' />
        </div>
      </div>

      {/* Mobile Header */}
      <div className='skeleton-blueprint sticky top-[88px] z-10 mb-2 block h-12 border border-neutral-800 p-2 sm:hidden dark:border-neutral-600'>
        <div className='skeleton-blueprint skeleton-text h-full w-full' />
      </div>

      {/* Rows */}
      {[...Array(10)].map((_, index) => (
        <div
          key={index}
          className='relative border-b border-neutral-200 dark:border-neutral-700'
          style={{ height: `${desktopRowHeight}px` }}
        >
          {/* Color bar Skeleton */}
          <div className='skeleton-blueprint skeleton-text absolute top-0 left-0 h-2 w-[10%] bg-neutral-100/20 dark:bg-neutral-800/20' />

          {/* Desktop Loading Row Structure */}
          <div className='relative hidden h-full grid-cols-7 items-center p-2 sm:grid'>
            <div className='col-span-2 flex items-center gap-2'>
              <div className='skeleton-blueprint skeleton-solid h-10 w-10 rounded-full' />
              <div className='flex flex-col gap-1'>
                <div className='skeleton-blueprint skeleton-text h-4 w-32' />
                <div className='skeleton-blueprint skeleton-text h-3 w-24' />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
});
SkeletonResultsTable.displayName = 'SkeletonResultsTable';

const SkeletonNonVotersTable = React.forwardRef<
  HTMLDivElement,
  { className?: string }
>(({ className }, ref) => {
  return (
    <div ref={ref} className={cn('mt-6', className)}>
      <div className='skeleton-blueprint sticky z-10 grid h-12 grid-cols-7 items-center gap-2 border-t border-r border-l border-neutral-800 p-2 dark:border-neutral-600'>
        <div className='col-span-2 flex items-center'>
          <div className='skeleton-blueprint skeleton-text h-4 w-full' />
        </div>
        <div className='col-span-5 flex items-center justify-end gap-2'>
          <div className='skeleton-blueprint skeleton-text h-4 w-24' />
        </div>
      </div>
    </div>
  );
});
SkeletonNonVotersTable.displayName = 'SkeletonNonVotersTable';

const SkeletonTimeline = React.forwardRef<
  HTMLDivElement,
  { className?: string }
>(({ className }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        'fixed top-24 left-28 z-20 hidden h-screen w-44 flex-col items-end justify-start sm:flex',
        className
      )}
    >
      <div className='relative h-[calc(100vh-96px)] w-full'>
        {/* Top SVG Placeholder */}
        <div className='absolute top-2 flex h-8 w-8 items-center justify-center rounded-xs border-2 border-neutral-200 bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800'>
          <div className='h-6 w-6 border border-dashed border-neutral-400 bg-neutral-200/50 dark:border-neutral-500 dark:bg-neutral-700/30' />
        </div>

        {/* Vertical Line Placeholder */}
        <div className='absolute top-2 bottom-4 left-[15px] z-10 w-0.5 bg-neutral-300 dark:bg-neutral-600' />

        {/* Bottom SVG Placeholder */}
        <div className='absolute bottom-1 flex h-8 w-8 items-center justify-center rounded-xs border-2 border-neutral-200 bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800'>
          <div className='h-6 w-6 border border-dashed border-neutral-400 bg-neutral-200/50 dark:border-neutral-500 dark:bg-neutral-700/30' />
        </div>

        {/* Placeholder Items */}
        <div className='flex h-full flex-col gap-16 pt-2'>
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className='relative flex w-full items-center justify-start'
            >
              <div className='z-20 flex h-[120px] w-28 flex-col gap-2 rounded-l-xs border border-neutral-200 bg-white px-4 py-2 dark:border-neutral-700 dark:bg-neutral-800'>
                <div className='skeleton-blueprint skeleton-text h-4 w-20' />
                <div className='skeleton-blueprint skeleton-text h-4 w-16' />
                <div className='skeleton-blueprint skeleton-text h-4 w-20' />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});
SkeletonTimeline.displayName = 'SkeletonTimeline';

const SkeletonChart = React.forwardRef<HTMLDivElement, { className?: string }>(
  ({ className }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex h-[600px] w-full items-center justify-center bg-neutral-100 dark:bg-neutral-900',
          className
        )}
      >
        <div className='skeleton-blueprint skeleton-text p-4 text-center text-neutral-500'>
          Loading chart...
        </div>
      </div>
    );
  }
);
SkeletonChart.displayName = 'SkeletonChart';

// Legacy aliases for backward compatibility
const LoadingHeader = SkeletonHeader;
const LoadingGroupList = SkeletonGroupList;

// Simple header skeleton for page-level loading
const HeaderSkeleton = React.forwardRef<HTMLDivElement, { className?: string }>(
  ({ className }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'mb-6 flex flex-col items-start justify-between space-y-4 sm:flex-row sm:items-center sm:space-y-0',
          className
        )}
      >
        <SkeletonText width='12rem' size='lg' />
        <SkeletonButton size='md' />
      </div>
    );
  }
);
HeaderSkeleton.displayName = 'HeaderSkeleton';

// Group Item Skeleton - for individual group items in lists
const SkeletonGroupItemDetailed = React.forwardRef<
  HTMLDivElement,
  { className?: string }
>(({ className }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        'rounded-xs border border-neutral-200 bg-white p-2 sm:p-3 dark:border-neutral-700 dark:bg-neutral-950',
        className
      )}
    >
      <div className='relative flex flex-col gap-1 sm:gap-2'>
        <div className='flex flex-col items-start justify-between gap-2 sm:flex-row sm:gap-0'>
          <div className='flex max-w-[60%] items-start gap-2 sm:max-w-3/4'>
            <div className='skeleton-blueprint skeleton-solid min-h-[32px] min-w-[32px] rounded-full sm:min-h-[40px] sm:min-w-[40px]' />
            <div>
              <div className='skeleton-blueprint skeleton-text mb-1 h-5 w-32' />
              <div className='skeleton-blueprint skeleton-text h-4 w-20' />
            </div>
          </div>
          <div className='skeleton-blueprint skeleton-text h-16 w-32' />
        </div>
      </div>
    </div>
  );
});
SkeletonGroupItemDetailed.displayName = 'SkeletonGroupItemDetailed';

// AI Summary Loading State - for AI generation loading
const SkeletonAISummaryLoading = React.forwardRef<
  HTMLDivElement,
  { className?: string; children?: React.ReactNode }
>(({ className, children }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        'skeleton-blueprint skeleton-text flex items-center justify-center space-x-2 p-3 text-neutral-500 dark:text-neutral-400',
        className
      )}
    >
      {children}
    </div>
  );
});
SkeletonAISummaryLoading.displayName = 'SkeletonAISummaryLoading';

// Enhanced Group Item Skeleton - for streaming group items with enhanced visual fidelity
const SkeletonGroupItemEnhanced = React.forwardRef<
  HTMLDivElement,
  { className?: string }
>(({ className }, ref) => {
  return (
    <SkeletonCard
      ref={ref}
      className={cn('p-2 sm:p-3', className)}
      padding={false}
    >
      <div className='relative flex flex-col gap-1 sm:gap-2'>
        <div className='flex flex-col items-start justify-between gap-2 sm:flex-row sm:gap-0'>
          <div className='flex max-w-[60%] items-start gap-2 sm:max-w-3/4'>
            <SkeletonAvatar size='md' className='sm:h-10 sm:w-10' />
            <div className='space-y-1'>
              <SkeletonText width='8rem' size='md' />
              <SkeletonText width='5rem' size='sm' />
            </div>
          </div>
          <div className='space-y-1'>
            <SkeletonText width='8rem' size='sm' />
            <SkeletonText width='6rem' size='xs' />
          </div>
        </div>
      </div>
    </SkeletonCard>
  );
});
SkeletonGroupItemEnhanced.displayName = 'SkeletonGroupItemEnhanced';

export {
  Skeleton,
  SkeletonText,
  SkeletonAvatar,
  SkeletonButton,
  SkeletonCard,
  SkeletonPost,
  SkeletonVoteItem,
  SkeletonList,
  // Page layouts
  SkeletonMainPage,
  SkeletonGroupPage,
  SkeletonResultsPage,
  SkeletonVPPage,
  // Headers
  SkeletonHeader,
  SkeletonBodyHeader,
  SkeletonResultsHeader,
  HeaderSkeleton,
  // Content
  SkeletonBody,
  SkeletonMenuBar,
  // Lists and groups
  SkeletonGroupList,
  SkeletonGroupItem,
  SkeletonGroupItemDetailed,
  SkeletonGroupItemEnhanced,
  // Feed
  SkeletonFeed,
  SkeletonPostItem,
  SkeletonVoteItemFeed,
  // Results
  SkeletonResults,
  SkeletonResultsTitle,
  SkeletonResultsList,
  SkeletonResultsTable,
  SkeletonNonVotersTable,
  SkeletonTimeline,
  SkeletonChart,
  // Specialized components
  SkeletonAISummaryLoading,
  // Legacy aliases
  LoadingHeader,
  LoadingGroupList,
  skeletonVariants,
  type SkeletonProps,
};
