import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const origin = request.headers.get('origin');
  const allowedOrigins = [
    'https://proposalapp-test.discourse.group',
    'https://discourse.proposal.vote',
  ];

  const corsOrigin = allowedOrigins.includes(origin || '')
    ? origin!
    : allowedOrigins[0];

  return new Response(
    JSON.stringify({
      value: `VP: ${Math.floor(Math.random() * 1001)}`,
      url: 'https://arbitrum.proposals.app',
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers':
          'Content-Type, Discourse-Logged-In, Discourse-Present',
      },
    }
  );
}

export function OPTIONS(request: NextRequest) {
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
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers':
        'Content-Type, Discourse-Logged-In, Discourse-Present',
    },
  });
}
