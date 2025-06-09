import { VolumeEvent } from '@/app/components/timeline/shared';

interface CommentsVolumeProps {
  timestamp: Date;
  width: number;
  last: boolean;
  index: number;
}

export function CommentsVolume({
  timestamp,
  width,
  last,
  index,
}: CommentsVolumeProps) {
  return (
    <VolumeEvent
      timestamp={timestamp}
      width={width}
      last={last}
      index={index}
      type='comments'
      showContent={true}
    />
  );
}
