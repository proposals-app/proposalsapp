import { NextResponse, type NextRequest } from 'next/server';

export const config = {
  runtime: 'nodejs', // Specify the runtime environment as Node.js
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

  // Read configuration from env with sensible defaults
  const envRoot = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'proposals.app';
  const specialFromEnv = (
    process.env.NEXT_PUBLIC_SPECIAL_SUBDOMAINS || 'arbitrum,uniswap'
  )
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  // Homepage redirect to arbitrum subdomain
  if (url.pathname === '/') {
    // Check if we're not already on a subdomain
    const isArbitrumSubdomain = hostname.startsWith('arbitrum.');
    const isUniswapSubdomain = hostname.startsWith('uniswap.');

    if (!isArbitrumSubdomain && !isUniswapSubdomain) {
      const isLocal = hostname.includes('localhost');
      const protocol = isLocal ? 'http' : 'https';
      // Extract host and port
      const [hostOnly, port] = hostname.split(':');
      const targetHost = isLocal
        ? `arbitrum.${hostOnly}`
        : `arbitrum.${hostOnly}`;
      const redirect = new URL(url);
      redirect.protocol = `${protocol}:`;
      redirect.hostname = targetHost;
      // Preserve port in dev
      redirect.port = isLocal && port ? port : '';
      return NextResponse.redirect(redirect);
    }
  }

  // Get configured domain from env or use default based on environment
  const defaultDomain = hostname.includes('localhost') ? 'localhost' : envRoot;
  const configuredRootDomain = defaultDomain;

  // Special subdomains with custom implementations
  const specialSubdomains = specialFromEnv;

  // Remove protocol and trailing slashes
  const rootDomain = configuredRootDomain
    .replace(/^(https?:\/\/)?/, '')
    .replace(/\/$/, '');

  // Check if we're running in development with localhost
  const isDev = hostname.includes('localhost');

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
    const hostOnly = hostname.split(':')[0];
    if (hostOnly !== rootDomain && hostOnly.endsWith(`.${rootDomain}`)) {
      subdomain = hostOnly.replace(`.${rootDomain}`, '');
    }
  }

  // BLOCK DIRECT PATH ACCESS: If accessing root domain with /arbitrum or /uniswap paths, redirect to subdomain
  if (
    !subdomain &&
    specialSubdomains.some((special) => url.pathname.startsWith(`/${special}`))
  ) {
    const detectedDao = specialSubdomains.find((special) =>
      url.pathname.startsWith(`/${special}`)
    );
    if (detectedDao) {
      // Redirect to proper subdomain
      const targetUrl = new URL(request.url);
      const [hostOnly, port] = hostname.split(':');
      targetUrl.hostname = `${detectedDao}.${hostOnly}`;
      targetUrl.pathname = url.pathname.replace(`/${detectedDao}`, '') || '/';
      // Preserve port for dev
      targetUrl.port = isDev && port ? port : '';

      return NextResponse.redirect(targetUrl, 301);
    }
  }

  // If no valid subdomain was found, proceed normally
  if (!subdomain) {
    return NextResponse.next();
  }

  // Rewrite to real slug path so Next.js params are populated
  if (!url.pathname.startsWith(`/${subdomain}`)) {
    url.pathname = `/${subdomain}${url.pathname}`;
  }
  return NextResponse.rewrite(url);
}
