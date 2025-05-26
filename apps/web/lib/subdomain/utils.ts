/**
 * Subdomain Utility Functions
 * Helper functions for working with subdomains in the application
 */

/**
 * Types for subdomain operations
 */
export type SubdomainInfo = {
  subdomain: string | null;
  isSpecialSubdomain: boolean;
  rootDomain: string;
  isDevelopment: boolean;
  hostname: string;
};

/**
 * Extract subdomain information from a hostname
 * @param hostname The hostname from the request (e.g., 'arbitrum.domain.com')
 * @param configuredRootDomain The configured root domain (e.g., 'domain.com')
 * @param specialSubdomains Array of special subdomains with custom implementations
 * @returns Object containing subdomain information
 */
export function extractSubdomainInfo(
  hostname: string,
  configuredRootDomain: string = process.env.NEXT_PUBLIC_ROOT_DOMAIN ||
    'localhost:3000',
  specialSubdomains: string[] = process.env.NEXT_PUBLIC_SPECIAL_SUBDOMAINS?.split(
    ','
  ) || ['arbitrum', 'uniswap']
): SubdomainInfo {
  // Remove protocol and trailing slashes
  const rootDomain = configuredRootDomain
    .replace(/^(https?:\/\/)?/, '')
    .replace(/\/$/, '');

  // Check if we're running in development with localhost
  const isDevelopment = rootDomain.includes('localhost');

  // Extract subdomain differently based on environment
  let subdomain: string | null = null;

  if (isDevelopment) {
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

  // Check if this is a special subdomain
  const isSpecialSubdomain = subdomain
    ? specialSubdomains.includes(subdomain)
    : false;

  return {
    subdomain,
    isSpecialSubdomain,
    rootDomain,
    isDevelopment,
    hostname,
  };
}

/**
 * Check if the current hostname has a subdomain
 * @param hostname The hostname to check
 * @returns boolean indicating if the hostname has a subdomain
 */
export function hasSubdomain(hostname: string): boolean {
  const { subdomain } = extractSubdomainInfo(hostname);
  return !!subdomain;
}

/**
 * Get the URL for a specific subdomain
 * @param subdomain The subdomain to generate URL for
 * @param path Optional path to append to the URL
 * @param protocol Protocol to use (defaults to current protocol or https)
 * @returns Complete URL for the subdomain
 */
export function getSubdomainUrl(
  subdomain: string,
  path: string = '',
  protocol: string = typeof window !== 'undefined'
    ? window.location.protocol
    : 'https:'
): string {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000';
  const isDevelopment = rootDomain.includes('localhost');

  // Format the path to ensure it starts with a slash if provided
  const formattedPath = path ? (path.startsWith('/') ? path : `/${path}`) : '';

  if (isDevelopment) {
    // In development: subdomain.localhost:3000
    return `${protocol}//${subdomain}.${rootDomain}${formattedPath}`;
  } else {
    // In production: subdomain.domain.com
    return `${protocol}//${subdomain}.${rootDomain}${formattedPath}`;
  }
}

/**
 * Get the list of all special subdomains
 * @returns Array of special subdomain strings
 */
export function getSpecialSubdomains(): string[] {
  return (
    process.env.NEXT_PUBLIC_SPECIAL_SUBDOMAINS?.split(',') || [
      'arbitrum',
      'uniswap',
    ]
  );
}
