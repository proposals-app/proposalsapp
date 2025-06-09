import * as React from 'react';
import { type VariantProps, cva } from 'class-variance-authority';

import { cn } from '../../../lib/utils';

const skeletonVariants = cva(
  'animate-pulse rounded-md bg-neutral-200 dark:bg-neutral-700/80',
  {
    variants: {
      variant: {
        default: '',
        text: 'rounded-sm',
        avatar: 'rounded-full',
        button: 'rounded-md',
        card: 'rounded-lg',
        input: 'rounded-md',
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
  }
);

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
      className={cn(sizeClasses[size], className)}
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
        <div className='h-1 w-full rounded-full bg-gradient-to-r from-neutral-200 to-neutral-300 dark:from-neutral-700 dark:to-neutral-600' />
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

export {
  Skeleton,
  SkeletonText,
  SkeletonAvatar,
  SkeletonButton,
  SkeletonCard,
  SkeletonPost,
  SkeletonVoteItem,
  SkeletonList,
  skeletonVariants,
  type SkeletonProps,
};
