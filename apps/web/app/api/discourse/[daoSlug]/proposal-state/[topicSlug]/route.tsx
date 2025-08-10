import { getFeed } from '@/app/(dao)/[daoSlug]/(main_page)/[groupId]/actions';
import { FeedFilterEnum, FromFilterEnum } from '@/app/searchParams';
import satori from 'satori';
import type { NextRequest } from 'next/server';
import { DiscourseResultCard } from './components/results/discourse-result-card';
import { TimelineEventType, type ProposalGroupItem } from '@/lib/types';
import { db } from '@proposalsapp/db';

// Function to get group ID from topic slug
async function getGroupIdFromTopicSlug(
  daoSlug: string,
  topicSlug: string
): Promise<string | null> {
  // 'use cache';

  // First, get the DAO
  const dao = await db
    .selectFrom('dao')
    .where('slug', '=', daoSlug)
    .select(['id'])
    .executeTakeFirst();

  if (!dao) return null;

  // Get the DAO discourse configuration
  const daoDiscourse = await db
    .selectFrom('daoDiscourse')
    .where('daoId', '=', dao.id)
    .select(['id'])
    .executeTakeFirst();

  if (!daoDiscourse) return null;

  // Find the discourse topic by slug
  const discourseTopic = await db
    .selectFrom('discourseTopic')
    .where('slug', '=', topicSlug)
    .where('daoDiscourseId', '=', daoDiscourse.id)
    .select(['externalId', 'daoDiscourseId'])
    .executeTakeFirst();

  if (!discourseTopic) return null;

  // Find the proposal group containing this topic
  const proposalGroups = await db
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

  // Add cache jitter: 60 seconds base + random 0-30 seconds
  const cacheMaxAge = 60 + Math.floor(Math.random() * 30);

  // Extract query parameters for width, height, and debug mode
  const { searchParams } = new URL(request.url);
  // Use higher resolution defaults for better image quality
  const width = parseInt(searchParams.get('width') || '1200', 10);
  const baseHeight = parseInt(searchParams.get('height') || '60', 10);
  // Double the height when width < 600 for two-row layout
  const height = width < 600 ? baseHeight * 2 : baseHeight;
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
          backgroundColor: '#ffffff',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ color: '#000000' }}>
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
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers':
          'Content-Type, Authorization, X-Requested-With, Discourse-Logged-In, Discourse-Present',
        'Access-Control-Allow-Credentials': 'true',
        'Cache-Control': `public, max-age=${cacheMaxAge}, stale-while-revalidate=30`,
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
          backgroundColor: '#ffffff',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ color: '#000000' }}>No valid result found</div>
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
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers':
          'Content-Type, Authorization, X-Requested-With, Discourse-Logged-In, Discourse-Present',
        'Access-Control-Allow-Credentials': 'true',
        'Cache-Control': `public, max-age=${cacheMaxAge}, stale-while-revalidate=30`,
      },
    });
  }

  const svg = await satori(
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        backgroundColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0',
      }}
    >
      <DiscourseResultCard
        result={result.result}
        debugBar={debug}
        width={width}
      />
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
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers':
        'Content-Type, Authorization, X-Requested-With, Discourse-Logged-In, Discourse-Present',
      'Access-Control-Allow-Credentials': 'true',
      'Cache-Control': 'no-cache, no-store, max-age=0, must-revalidate',
    },
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers':
        'Content-Type, Authorization, X-Requested-With, Discourse-Logged-In, Discourse-Present',
      'Access-Control-Allow-Credentials': 'true',
    },
  });
}
