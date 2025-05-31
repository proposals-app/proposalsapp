import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const config = {
  matcher: [
    /*
     * Match all paths except for:
     * 1. /api routes
     * 2. /_next (Next.js internals)
     * 3. /static (inside /public)
     * 4. /assets (inside /public)
     * 5. all root files inside /public (e.g. /favicon.ico)
     */
    '/((?!api|_next|static|assets|ingest|[\\w-]+\\.\\w+).*)',
  ],
};

export default function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const hostname = request.headers.get('host') || '';

  // Get configured domain from env or use default for local development
  const configuredRootDomain =
    process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000';

  // Special subdomains with custom implementations
  const specialSubdomains = process.env.NEXT_PUBLIC_SPECIAL_SUBDOMAINS?.split(
    ','
  ) || ['arbitrum', 'uniswap'];

  // Remove protocol and trailing slashes
  const rootDomain = configuredRootDomain
    .replace(/^(https?:\/\/)?/, '')
    .replace(/\/$/, '');

  // Check if we're running in development with localhost
  const isDev = rootDomain.includes('localhost');

  // Extract subdomain differently based on environment
  let subdomain = '';
  if (isDev) {
    // In development, subdomains might be represented as subdomain.localhost:3000
    const hostnameWithoutPort = hostname.split(':')[0];
    const parts = hostnameWithoutPort.split('.');
    // If we have a valid subdomain pattern (something.localhost)
    if (parts.length > 1 && parts[parts.length - 1] === 'localhost') {
      subdomain = parts[0];
    }
  } else {
    // In production, extract subdomain from hostname
    if (hostname !== rootDomain && hostname.endsWith(`.${rootDomain}`)) {
      subdomain = hostname.replace(`.${rootDomain}`, '');
    }
  }

  // If no valid subdomain was found, proceed normally
  if (!subdomain) {
    return NextResponse.next();
  }

  // Handle specific subdomains with specialized implementations
  if (specialSubdomains.includes(subdomain)) {
    // Rewrite to the specialized implementation
    url.pathname = `/${subdomain}${url.pathname}`;
    return NextResponse.rewrite(url);
  }
  // Handle other DAOs through the dynamic [daoSlug] route
  else {
    // Rewrite to the dynamic [daoSlug] route
    url.pathname = `/[daoSlug]${url.pathname}`;
    // Store the actual slug in searchParams to be accessed in the page
    url.searchParams.set('daoSlug', subdomain);
    return NextResponse.rewrite(url);
  }
}
