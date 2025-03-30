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
    '/((?!api|_next|static|assets|[\\w-]+\\.\\w+).*)',
  ],
};

export default function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const hostname = request.headers.get('host') || '';
  const configuredRootDomain =
    process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'example.com';

  // Strip http:// or https:// and any trailing slashes from the configured root domain
  const rootDomain = configuredRootDomain
    .replace(/^(https?:\/\/)?/, '')
    .replace(/\/$/, '');

  // Get the subdomain from the hostname
  const subdomain = hostname.replace(`.${rootDomain}`, '');

  if (hostname !== rootDomain) {
    // Rewrite the URL to include the subdomain as the daoSlug
    if (subdomain) {
      // Rewrite the URL pathname
      url.pathname = `/${subdomain}${url.pathname}`;
      return NextResponse.rewrite(url);
    }
  }

  return NextResponse.next();
}
