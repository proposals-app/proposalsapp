export async function GET() {
  return new Response(
    JSON.stringify({ value: '123', url: 'https://arbitrum.proposals.app' }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin':
          'https://proposalapp-test.discourse.group', // or "*" for dev
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
