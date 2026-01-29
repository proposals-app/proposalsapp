import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.WEB_URL || 'https://proposals.app';
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/mapping/'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
