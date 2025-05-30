# Subdomain Routing Implementation

## Overview

This project implements subdomain-based routing to provide distinct experiences for different DAOs. It supports both specialized implementations (e.g., `arbitrum.domain.com`, `uniswap.domain.com`) and generic implementations for any DAO via `dao-name.domain.com`.

## How It Works

The routing system consists of several key components:

### 1. Middleware (`middleware.ts`)

The middleware intercepts all incoming requests and:

1. Extracts the subdomain from the hostname
2. Determines if it's a "special" subdomain with a custom implementation
3. Rewrites the URL path based on the subdomain:
   - For special subdomains (e.g., `arbitrum`): Rewrites to `/arbitrum/...`
   - For other subdomains: Rewrites to `/[daoSlug]/...` with the subdomain as a query parameter

### 2. Route Structure

- `/app/[daoSlug]/...` - Generic implementation for any DAO
- `/app/arbitrum/...` - Specialized implementation for Arbitrum
- `/app/uniswap/...` - Specialized implementation for Uniswap

### 3. Environment Configuration

Environment variables control the behavior:

- `NEXT_PUBLIC_ROOT_DOMAIN`: The root domain without subdomain (e.g., `domain.com`)
- `NEXT_PUBLIC_SPECIAL_SUBDOMAINS`: Comma-separated list of subdomains with specialized implementations

## Development Setup

Follow the instructions in `SUBDOMAIN_SETUP.md` to configure your local environment for testing subdomains.

## Utility Functions

Utility functions for working with subdomains are available in `lib/subdomain/utils.ts`:

- `extractSubdomainInfo(hostname)`: Extract subdomain information
- `hasSubdomain(hostname)`: Check if a hostname has a subdomain
- `getSubdomainUrl(subdomain, path)`: Generate a URL for a specific subdomain
- `getSpecialSubdomains()`: Get the list of special subdomains

## Adding a New Special Subdomain

1. Update `NEXT_PUBLIC_SPECIAL_SUBDOMAINS` to include the new subdomain
2. Create a new directory in `/app` with the subdomain name
3. Implement the necessary files (page.tsx, layout.tsx, etc.)

## Common Issues

### Middleware Not Running

Check that the matcher pattern in `middleware.ts` isn't excluding your routes:

```typescript
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
```

### Subdomain Not Detected

- In development: Ensure your hosts file is configured correctly
- In production: Check DNS configuration and verify the middleware logic

### Special Implementation Not Loading

- Verify the subdomain is included in `NEXT_PUBLIC_SPECIAL_SUBDOMAINS`
- Check that the directory structure matches the expected path

## Debugging

In development mode, a debug component shows:

- Current hostname
- Detected subdomain
- Whether it's a special subdomain
- Current environment (development/production)

## Technical Implementation Details

### URL Rewriting vs. Redirecting

The middleware uses `NextResponse.rewrite()` rather than `redirect()` to:

1. Keep the URL in the browser unchanged (preserving the subdomain)
2. Internally route to the appropriate implementation

### Development vs. Production

The middleware handles differences between development and production:

- Development: Subdomains use the pattern `subdomain.localhost:3000`
- Production: Subdomains use the pattern `subdomain.domain.com`

### Query Parameters

For generic DAO implementations, the subdomain is passed as a query parameter (`daoSlug`) to preserve the original value, as the path parameter gets normalized to `[daoSlug]`.
