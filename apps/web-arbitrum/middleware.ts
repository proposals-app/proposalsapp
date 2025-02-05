import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const config = {
  matcher: [
    /*
     * Match all paths except for:
     * 1. /api routes
     * 2. /_next (Next.js internals)
     * 3. /static (inside /public)
     * 4. all root files inside /public (e.g. /favicon.ico)
     */
    '/((?!api|_next|static|[\\w-]+\\.\\w+).*)',
  ],
};

export default function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const hostname = request.headers.get('host') || '';
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'example.com';

  // If the hostname is the root domain, redirect to a default subdomain
  if (hostname === rootDomain) {
    return NextResponse.redirect(new URL(`https://arbitrum.${rootDomain}`));
  }

  // Get the subdomain from the hostname
  const subdomain = hostname.replace(`.${rootDomain}`, '');

  // Rewrite the URL to include the subdomain as the daoSlug
  if (subdomain) {
    // Rewrite the URL pathname
    url.pathname = `/${subdomain}${url.pathname}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}
