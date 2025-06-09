import { auth as arbitrumAuth } from '@/lib/auth/arbitrum_auth';
import { auth as uniswapAuth } from '@/lib/auth/uniswap_auth';
import { toNextJsHandler } from 'better-auth/next-js';
import { NextResponse, type NextRequest } from 'next/server';

// Create handlers for each auth provider
const arbitrumHandler = toNextJsHandler(arbitrumAuth.handler);
const uniswapHandler = toNextJsHandler(uniswapAuth.handler);

// Route requests based on the domain
async function routeRequest(req: NextRequest, method: 'GET' | 'POST') {
  const host = req.headers.get('host') || '';

  if (host.startsWith('arbitrum.')) {
    return arbitrumHandler[method](req);
  } else if (host.startsWith('uniswap.')) {
    return uniswapHandler[method](req);
  } else {
    return new NextResponse(JSON.stringify({ error: 'Invalid domain' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Export the GET and POST handlers
export async function GET(req: NextRequest) {
  return routeRequest(req, 'GET');
}

export async function POST(req: NextRequest) {
  return routeRequest(req, 'POST');
}
