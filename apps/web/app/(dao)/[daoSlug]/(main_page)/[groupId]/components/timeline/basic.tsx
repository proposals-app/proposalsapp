import { BasicEvent } from '@/app/components/timeline/shared';
import type { TimelineEventType } from '@/lib/types';

interface BasicProps {
  content: string;
  timestamp: Date;
  url: string;
  type: TimelineEventType;
}

export function Basic({ content, url, type }: BasicProps) {
  return (
    <BasicEvent
      content={content}
      url={url}
      type={type}
      showContent={true}
      showExternalLink={true}
    />
  );
}
