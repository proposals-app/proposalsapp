// app/api/discourse/uniswap/vp-tag/[username]/route.ts (or your actual path)
import { NextRequest, NextResponse } from 'next/server';

// It's good practice to list the headers Discourse might send
const ALLOWED_HEADERS = [
  'Content-Type',
  'Discourse-Logged-In', // <-- Add this
  'Discourse-Present', // <-- Add this (Discourse often sends this too)
  'X-Requested-With', // Common for AJAX requests
  'X-CSRF-Token', // If CSRF protection is involved on Discourse side for POSTs etc.
  // Add any other custom headers your client might send
].join(', ');

export async function GET(
  request: NextRequest,
  { params }: { params: { username: string } } // Assuming you're using the username from the path
) {
  try {
    const username = params.username; // Get username from dynamic route segment
    const { searchParams } = new URL(request.url);
    const timestamp = searchParams.get('timestamp');
    const unixTimestamp = timestamp ? parseInt(timestamp) : null;

    // Simulate fetching data based on username too if needed
    console.log(
      `API called for username: ${username}, timestamp: ${unixTimestamp}`
    );

    const currentVP = Math.floor(Math.random() * 1001);
    const historicalVP = unixTimestamp
      ? Math.floor(Math.random() * 801)
      : currentVP; // If no timestamp, historical might be same as current

    return new NextResponse(
      JSON.stringify({
        currentVP: `${currentVP} UNI`,
        historicalVP: `${historicalVP} UNI`,
        url: 'https://arbitrum.proposals.app',
        timestampProcessed: unixTimestamp,
        usernameProcessed: username,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': ALLOWED_HEADERS,
        },
      }
    );
  } catch (error) {
    console.error('API Error:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Internal server error';
    return new NextResponse(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': ALLOWED_HEADERS,
      },
    });
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': ALLOWED_HEADERS,
      'Access-Control-Max-Age': '86400',
    },
  });
}
