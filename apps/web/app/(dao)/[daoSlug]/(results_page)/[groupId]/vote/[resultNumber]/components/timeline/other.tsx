import {
  BasicEvent,
  VolumeEvent,
} from '@/app/(dao)/[daoSlug]/components/timeline/shared';
import { TimelineEventType } from '@/lib/types';

export function VotesVolume() {
  return <VolumeEvent width={0} type='votes' showContent={false} />;
}

export function CommentsVolume() {
  return <VolumeEvent width={0} type='comments' showContent={false} />;
}

export function Basic() {
  return (
    <BasicEvent
      content=''
      type={TimelineEventType.Basic}
      showContent={false}
      showExternalLink={false}
    />
  );
}
