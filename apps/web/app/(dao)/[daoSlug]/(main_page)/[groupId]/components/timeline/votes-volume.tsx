import { VolumeEvent } from '@/app/(dao)/[daoSlug]/components/timeline/shared';

interface VotesVolumeProps {
  timestamp: Date;
  width: number;
  last: boolean;
  volumes: number[]; // Array of volumes by choice
  colors: string[]; // Array of colors for each choice
  index: number;
}

export function VotesVolume({
  timestamp,
  width,
  last,
  volumes,
  colors,
  index,
}: VotesVolumeProps) {
  return (
    <VolumeEvent
      timestamp={timestamp}
      width={width}
      last={last}
      index={index}
      type='votes'
      volumes={volumes}
      colors={colors}
      showContent={true}
    />
  );
}
