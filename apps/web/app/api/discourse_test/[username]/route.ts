export async function GET() {
  return new Response(
    JSON.stringify({
      value: Math.floor(Math.random() * 1001),
      url: 'https://arbitrum.proposals.app',
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin':
          'https://proposalapp-test.discourse.group',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers':
          'Content-Type, Discourse-Logged-In, Discourse-Present',
      },
    }
  );
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': 'https://proposalapp-test.discourse.group',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers':
        'Content-Type, Discourse-Logged-In, Discourse-Present',
    },
  });
}
