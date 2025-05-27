import { NextRequest } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const origin = request.headers.get('origin');
  const allowedOrigins = [
    'https://proposalapp-test.discourse.group',
    'https://discourse.proposal.vote',
  ];
  const corsOrigin = allowedOrigins.includes(origin || '')
    ? origin!
    : allowedOrigins[0];

  const { username } = await params;
  const searchParams = request.nextUrl.searchParams;
  const timestamp = searchParams.get('timestamp');
  const unixTimestamp = timestamp ? parseInt(timestamp) : null;

  const currentVP = Math.floor(Math.random() * 1001);
  const historicalVP = unixTimestamp
    ? Math.floor(Math.random() * 801)
    : currentVP;

  return new Response(
    JSON.stringify({
      currentVP: `${currentVP} UNI`,
      historicalVP: `${historicalVP} UNI`,
      username,
      url: 'https://arbitrum.proposals.app',
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers':
          'Content-Type, Authorization, X-Requested-With, Discourse-Logged-In, Discourse-Present',
        'Access-Control-Allow-Credentials': 'true',
        'Cache-Control': 'no-cache, no-store, max-age=0, must-revalidate',
      },
    }
  );
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  const allowedOrigins = [
    'https://proposalapp-test.discourse.group',
    'https://discourse.proposal.vote',
  ];
  const corsOrigin = allowedOrigins.includes(origin || '')
    ? origin!
    : allowedOrigins[0];

  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers':
        'Content-Type, Authorization, X-Requested-With, Discourse-Logged-In, Discourse-Present',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400', // Cache preflight for 24 hours
    },
  });
}
