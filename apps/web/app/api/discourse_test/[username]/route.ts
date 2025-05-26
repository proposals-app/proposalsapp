export async function GET() {
  return new Response(
    JSON.stringify({
      value: `VP: ${Math.floor(Math.random() * 1001)}`,
      url: 'https://arbitrum.proposals.app',
      styles: {
        container: {
          padding: '8px 12px',
          backgroundColor: '#0079bf',
          color: 'white',
          fontWeight: '600',
          borderRadius: '4px',
          marginBottom: '8px',
          cursor: 'pointer',
          userSelect: 'none',
          maxWidth: 'fit-content',
          boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
          transition: 'background-color 0.2s ease',
        },
        hover: {
          backgroundColor: '#005c99',
        },
        error: {
          backgroundColor: '#d9534f',
        },
      },
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin':
          'https://proposalapp-test.discourse.group, https://discourse.proposal.vote',
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
      'Access-Control-Allow-Origin':
        'https://proposalapp-test.discourse.group, https://discourse.proposal.vote',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers':
        'Content-Type, Discourse-Logged-In, Discourse-Present',
    },
  });
}
