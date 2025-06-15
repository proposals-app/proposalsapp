import { SkeletonMenuBar } from '@/app/components/ui/skeleton';

export const LoadingMenuBar = () => {
  return <SkeletonMenuBar variant='full' />;
};

export const LoadingBodyViewBar = () => {
  return <SkeletonMenuBar variant='body' />;
};

export const LoadingCommentsViewBar = () => {
  return <SkeletonMenuBar variant='comments' />;
};

// Dynamic loading component that respects URL state
export const DynamicLoadingMenuBar = ({
  expanded = false,
}: {
  expanded?: boolean;
}) => {
  // If expanded=true, show body view skeleton, otherwise show full view skeleton
  return <SkeletonMenuBar variant={expanded ? 'body' : 'full'} />;
};
