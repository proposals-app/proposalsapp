import type { MetadataRoute } from 'next';
import { db } from '@proposalsapp/db';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.WEB_URL || 'https://proposals.app';

  // Get all DAOs
  const daos = await db.selectFrom('dao').select(['slug']).execute();

  // Get recent proposal groups
  const groups = await db
    .selectFrom('proposalGroup as pg')
    .innerJoin('dao as d', 'd.id', 'pg.daoId')
    .select(['pg.id', 'd.slug as daoSlug', 'pg.createdAt'])
    .where('pg.name', '!=', 'UNGROUPED')
    .orderBy('pg.createdAt', 'desc')
    .limit(1000)
    .execute();

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    ...daos.map((dao) => ({
      url: `${baseUrl}/${dao.slug}`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.9,
    })),
    ...groups.map((g) => ({
      url: `${baseUrl}/${g.daoSlug}/${g.id}`,
      lastModified: g.createdAt,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  ];
}
