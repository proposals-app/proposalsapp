import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const origin = request.headers.get('origin');
  const allowedOrigins = [
    'https://proposalapp-test.discourse.group',
    'https://discourse.proposal.vote',
  ];

  // More flexible CORS origin handling
  const corsOrigin = allowedOrigins.includes(origin || '') ? origin! : '*';

  try {
    // Get the timestamp parameter from the URL (Unix timestamp in seconds)
    const { searchParams } = new URL(request.url);
    const timestamp = searchParams.get('timestamp');
    const unixTimestamp = timestamp ? parseInt(timestamp) : null;

    // Generate mock data - replace with your actual VP calculation logic
    const currentVP = Math.floor(Math.random() * 1001);
    const historicalVP = unixTimestamp
      ? Math.floor(Math.random() * 801)
      : currentVP;

    const response = new Response(
      JSON.stringify({
        currentVP: `${currentVP} UNI`,
        historicalVP: `${historicalVP} UNI`,
        url: 'https://arbitrum.proposals.app',
        timestamp: unixTimestamp,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': corsOrigin,
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers':
            'Content-Type, Discourse-Logged-In, Discourse-Present',
          // 'Access-Control-Max-Age': '86400', // Cache preflight for 24 hours
        },
      }
    );

    return response;
  } catch (error) {
    console.error('API Error:', error);

    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': corsOrigin,
      },
    });
  }
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  const allowedOrigins = [
    'https://proposalapp-test.discourse.group',
    'https://discourse.proposal.vote',
  ];

  // More flexible CORS origin handling
  const corsOrigin = allowedOrigins.includes(origin || '') ? origin! : '*';

  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers':
        'Content-Type, Authorization, X-Requested-With, Accept, Origin, Referer, User-Agent, Discourse-Logged-In, Discourse-Present, Discourse-Track-View',
      'Access-Control-Allow-Credentials': 'true',
    },
  });
}
