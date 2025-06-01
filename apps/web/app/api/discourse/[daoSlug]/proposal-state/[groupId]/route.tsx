import { getFeed } from '@/app/(dao)/[daoSlug]/(main_page)/[groupId]/actions';
import { FeedFilterEnum, FromFilterEnum } from '@/app/searchParams';
import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { ResultCard } from './components/results/result-card';
import { TimelineEventType } from '@/lib/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ daoSlug: string; groupId: string }> }
) {
  const { daoSlug, groupId } = await params;

  const feedData = await getFeed(
    groupId,
    FeedFilterEnum.VOTES,
    FromFilterEnum.ALL,
    true
  );

  const result =
    feedData?.events && feedData.events.length > 0 ? feedData.events[0] : null;

  if (
    !result ||
    !(
      result.type === TimelineEventType.ResultOngoingBasicVote ||
      result.type === TimelineEventType.ResultOngoingOtherVotes ||
      result.type === TimelineEventType.ResultEndedBasicVote ||
      result.type === TimelineEventType.ResultEndedOtherVotes
    )
  )
    return new ImageResponse(<div style={{ display: 'flex' }}>idk</div>, {
      width: 1200,
      height: 630,
    });

  return new ImageResponse(
    (
      <div style={{ display: 'flex' }}>
        <ResultCard content={result.content} result={result.result} />
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
