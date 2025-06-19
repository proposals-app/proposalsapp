# Subdomain Routing Fix

## Issue Description

When accessing `arbitrum.proposal.vote`, the URL is being rewritten to `proposal.vote/arbitrum/arbitrum`, causing UUID validation errors because the system tries to parse "arbitrum" as a UUID.

## Root Cause Analysis

The issue appears to be a double path rewrite happening at two different layers:

1. **Cloudflare Tunnel Layer**: The Cloudflare tunnel might be configured to automatically add the subdomain to the path when routing requests. When a request comes to `arbitrum.proposal.vote`, it may be rewriting it to `proposal.vote/arbitrum/...`

2. **Next.js Middleware Layer**: The Next.js middleware then detects the subdomain and adds `/arbitrum` to the path again, resulting in `/arbitrum/arbitrum/...`

## Fixes Applied

### 1. Updated Next.js Middleware (apps/web/middleware.ts)

Added checks to prevent double path rewriting and redirect path-based access to subdomain:

```typescript
// BLOCK DIRECT PATH ACCESS: Redirect /arbitrum to arbitrum.proposal.vote
if (!subdomain && specialSubdomains.some(special => url.pathname.startsWith(`/${special}`))) {
  const detectedDao = specialSubdomains.find(special => url.pathname.startsWith(`/${special}`));
  if (detectedDao) {
    const targetUrl = new URL(request.url);
    targetUrl.hostname = `${detectedDao}.${rootDomain}`;
    targetUrl.pathname = url.pathname.replace(`/${detectedDao}`, '') || '/';
    return NextResponse.redirect(targetUrl, 301);
  }
}

// For special subdomains
if (specialSubdomains.includes(subdomain)) {
  // Check if the pathname already starts with the subdomain to avoid double routing
  if (!url.pathname.startsWith(`/${subdomain}`)) {
    url.pathname = `/${subdomain}${url.pathname}`;
  }
  return NextResponse.rewrite(url);
}
```

### 2. Fixed Domain Configuration Mismatch

Updated the default domain in the app to match infrastructure:

```typescript
// apps/web/app/layout.tsx
const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'proposal.vote';

// apps/web/middleware.ts  
const defaultDomain = hostname.includes('localhost') ? 'localhost:3000' : 'proposal.vote';
```

### 3. Removed Unused Traefik Middleware

Removed the `arbitrum-rewrite` middleware from Traefik configuration that was defined but not being used, to avoid confusion.

### 4. Added Debugging Logs

Added logging to help diagnose the issue if it persists:

```typescript
if (process.env.NODE_ENV === 'development' || url.pathname.includes(`/${subdomain}/${subdomain}`)) {
  console.log('[Middleware] Subdomain rewrite:', {
    subdomain,
    originalPath: request.nextUrl.pathname,
    rewrittenPath: url.pathname,
    wasAlreadyPrefixed: request.nextUrl.pathname.startsWith(`/${subdomain}`),
  });
}
```

## Cloudflare Configuration Check

If the issue persists after these fixes, check the Cloudflare tunnel configuration:

1. **Check Public Hostname Rules**: In the Cloudflare Zero Trust dashboard, verify how the public hostnames are configured:
   - `*.proposal.vote` should route to `http://traefik-http.service.consul:8080`
   - `proposal.vote` should route to `http://traefik-http.service.consul:8080`

2. **Path Rewriting**: Ensure that Cloudflare is NOT configured to add path prefixes based on subdomains. The tunnel should pass the requests through without modifying the path.

3. **Advanced Options**: Check if there are any URL rewrite rules or path manipulations in the Cloudflare tunnel configuration.

## Testing

After deploying these fixes:

1. **Subdomain Access (Should Work):**
   - Access `https://arbitrum.proposal.vote` and verify it loads correctly
   - Access `https://uniswap.proposal.vote` and verify it loads correctly
   - Navigate to proposal groups and ensure URLs are clean

2. **Path Access (Should Redirect):**
   - Access `https://proposal.vote/arbitrum` and verify it redirects to `https://arbitrum.proposal.vote`
   - Access `https://proposal.vote/uniswap` and verify it redirects to `https://uniswap.proposal.vote`

3. **Logs and Debugging:**
   - Check application logs for middleware redirect/rewrite messages
   - Ensure no double routing (`/arbitrum/arbitrum`) appears in logs
   - Verify redirect responses return 301 status

## Rollback Plan

If the fixes cause issues:

1. The middleware changes are backward compatible and should not break existing functionality
2. If needed, remove the path prefix checks from the middleware
3. The Traefik middleware removal is safe as it wasn't being used

## Long-term Solution

Consider implementing a more robust subdomain routing solution:

1. Use HTTP headers to pass the original subdomain information instead of path rewriting
2. Configure Cloudflare to pass a custom header with the subdomain
3. Update the application to read the subdomain from headers instead of the URL path