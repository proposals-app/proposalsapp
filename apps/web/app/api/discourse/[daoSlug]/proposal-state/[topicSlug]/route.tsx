import { getFeed } from '@/app/(dao)/[daoSlug]/(main_page)/[groupId]/actions';
import { FeedFilterEnum, FromFilterEnum } from '@/app/searchParams';
import satori from 'satori';
import type { NextRequest } from 'next/server';
import { StaticResultCard } from './components/results/static-result-card';
import { TimelineEventType, type ProposalGroupItem } from '@/lib/types';
import { db } from '@proposalsapp/db';

// Function to get group ID from topic slug
async function getGroupIdFromTopicSlug(
  daoSlug: string,
  topicSlug: string
): Promise<string | null> {
  'use cache';

  // First, get the DAO
  const dao = await db.public
    .selectFrom('dao')
    .where('slug', '=', daoSlug)
    .select(['id'])
    .executeTakeFirst();

  if (!dao) return null;

  // Get the DAO discourse configuration
  const daoDiscourse = await db.public
    .selectFrom('daoDiscourse')
    .where('daoId', '=', dao.id)
    .select(['id'])
    .executeTakeFirst();

  if (!daoDiscourse) return null;

  // Find the discourse topic by slug
  const discourseTopic = await db.public
    .selectFrom('discourseTopic')
    .where('slug', '=', topicSlug)
    .where('daoDiscourseId', '=', daoDiscourse.id)
    .select(['externalId', 'daoDiscourseId'])
    .executeTakeFirst();

  if (!discourseTopic) return null;

  // Find the proposal group containing this topic
  const proposalGroups = await db.public
    .selectFrom('proposalGroup')
    .where('daoId', '=', dao.id)
    .select(['id', 'items'])
    .execute();

  for (const group of proposalGroups) {
    const items = group.items as ProposalGroupItem[];

    // Check if this group contains the topic
    const hasMatchingTopic = items.some((item) => {
      if (item.type === 'topic') {
        return (
          item.externalId === discourseTopic.externalId.toString() &&
          item.daoDiscourseId === discourseTopic.daoDiscourseId
        );
      }
      return false;
    });

    if (hasMatchingTopic) {
      return group.id;
    }
  }

  return null;
}

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
  { params }: { params: Promise<{ daoSlug: string; topicSlug: string }> }
) {
  const { daoSlug, topicSlug } = await params;

  // Extract query parameters for width, height, and debug mode
  const { searchParams } = new URL(request.url);
  // Use higher resolution defaults for better image quality
  const width = parseInt(searchParams.get('width') || '1200', 10);
  const height = parseInt(searchParams.get('height') || '60', 10);
  const debug = searchParams.get('debug') === 'true';

  // Get the group ID from the topic slug
  const groupId = await getGroupIdFromTopicSlug(daoSlug, topicSlug);

  if (!groupId) {
    const svg = await satori(
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
          Topic not found or not part of any proposal group
        </div>
      </div>,
      {
        width,
        height,
        fonts: [
          {
            name: 'Fira Sans Condensed',
            data: (await getFiraSansCondensedFonts()).regular,
            weight: 400,
            style: 'normal',
          },
          {
            name: 'Fira Sans Condensed',
            data: (await getFiraSansCondensedFonts()).bold,
            weight: 700,
            style: 'normal',
          },
        ],
      }
    );

    return new Response(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
      },
    });
  }

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
  ) {
    const svg = await satori(
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
      </div>,
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

    return new Response(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
      },
    });
  }

  const svg = await satori(
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
      <StaticResultCard result={result.result} debugBar={debug} />
    </div>,
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

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
    },
  });
}
