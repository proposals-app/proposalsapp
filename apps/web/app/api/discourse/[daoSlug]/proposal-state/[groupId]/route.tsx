import { getFeed } from '@/app/(dao)/[daoSlug]/(main_page)/[groupId]/actions';
import { FeedFilterEnum, FromFilterEnum } from '@/app/searchParams';
import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';
import { StaticResultCard } from './components/results/static-result-card';
import { TimelineEventType } from '@/lib/types';

// Load Fira Sans Condensed fonts for better rendering
async function getFiraSansCondensedFonts() {
  const [regular, bold] = await Promise.all([
    fetch(
      'https://fonts.gstatic.com/s/firasanscondensed/v10/wEOhEADFm8hSaQTFG18FErVhsC9x-tarYfE.ttf'
    ),
    fetch(
      'https://fonts.gstatic.com/s/firasanscondensed/v10/wEOsEADFm8hSaQTFG18FErVhsC9x-tarWU3IiMM.ttf'
    ),
  ]);
  const [regularData, boldData] = await Promise.all([
    regular.arrayBuffer(),
    bold.arrayBuffer(),
  ]);
  return { regular: regularData, bold: boldData };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ daoSlug: string; groupId: string }> }
) {
  const { daoSlug: _daoSlug, groupId } = await params;

  // Extract query parameters for width, height, and debug mode
  const { searchParams } = new URL(request.url);
  // Use higher resolution defaults for better image quality
  const width = parseInt(searchParams.get('width') || '1600', 10);
  const height = parseInt(searchParams.get('height') || '200', 10);
  const debug = searchParams.get('debug') === 'true';
  const debugBar = searchParams.get('debugBar') === 'true';

  const [feedData, fonts] = await Promise.all([
    getFeed(groupId, FeedFilterEnum.VOTES, FromFilterEnum.ALL, true),
    getFiraSansCondensedFonts(),
  ]);

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
    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            width: '100%',
            height: '100%',
            backgroundColor: debug ? '#000000' : '#ffffff',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ color: debug ? '#ffffff' : '#000000' }}>
            No valid result found
          </div>
        </div>
      ),
      {
        width,
        height,
        fonts: [
          {
            name: 'Fira Sans Condensed',
            data: fonts.regular,
            weight: 400,
            style: 'normal',
          },
          {
            name: 'Fira Sans Condensed',
            data: fonts.bold,
            weight: 700,
            style: 'normal',
          },
        ],
      }
    );

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          backgroundColor: debug ? '#000000' : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0',
        }}
      >
        <StaticResultCard result={result.result} debugBar={debugBar} />
      </div>
    ),
    {
      width,
      height,
      fonts: [
        {
          name: 'Fira Sans Condensed',
          data: fonts.regular,
          weight: 400,
          style: 'normal',
        },
        {
          name: 'Fira Sans Condensed',
          data: fonts.bold,
          weight: 700,
          style: 'normal',
        },
      ],
    }
  );
}
