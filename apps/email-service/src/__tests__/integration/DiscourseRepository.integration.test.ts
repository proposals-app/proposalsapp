import { describe, it, expect, beforeEach, vi } from 'vitest';

// Set environment variables for testing BEFORE any imports that might validate them
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
}

import { setupTestDatabase, getTestDb } from './setup';
import { DiscourseRepository } from '../../repositories/DiscourseRepository';

setupTestDatabase();

describe('DiscourseRepository - Category Filtering Integration', () => {
  let discourseRepository: DiscourseRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    discourseRepository = new DiscourseRepository(getTestDb());
  });

  it('should filter out category 10 topics for Arbitrum even if they exist in database', async () => {
    const db = getTestDb();

    // Create test DAO
    const [dao] = await db
      .insertInto('dao')
      .values({
        name: 'Arbitrum DAO',
        slug: 'arbitrum',
        picture: 'https://example.com/arbitrum.jpg',
      })
      .returning(['id'])
      .execute();

    // Create test discourse instance
    const [discourse] = await db
      .insertInto('daoDiscourse')
      .values({
        daoId: dao.id,
        discourseBaseUrl: 'https://forum.arbitrum.foundation',
        enabled: true,
      })
      .returning(['id'])
      .execute();

    // Create discourse user
    const [user] = await db
      .insertInto('discourseUser')
      .values({
        daoDiscourseId: discourse.id,
        externalId: 1,
        username: 'testuser',
        name: 'Test User',
        avatarTemplate: 'avatar.png',
      })
      .returning(['id', 'externalId'])
      .execute();

    // Create topics in different categories
    const topics = [];
    for (const categoryId of [7, 8, 10]) {
      const [topic] = await db
        .insertInto('discourseTopic')
        .values({
          daoDiscourseId: discourse.id,
          externalId: categoryId * 100,
          title: `Test Topic in Category ${categoryId}`,
          slug: `test-topic-${categoryId}`,
          fancyTitle: `Test Topic in Category ${categoryId}`,
          categoryId,
          archived: false,
          closed: false,
          pinned: false,
          pinnedGlobally: false,
          visible: true,
          postsCount: 1,
          replyCount: 0,
          likeCount: 0,
          views: 10,
          createdAt: new Date(),
          bumpedAt: new Date(),
          lastPostedAt: new Date(),
        })
        .returning(['id', 'externalId', 'categoryId'])
        .execute();

      // Create first post for each topic
      await db
        .insertInto('discoursePost')
        .values({
          daoDiscourseId: discourse.id,
          externalId: categoryId * 1000,
          topicId: topic.externalId,
          topicSlug: `test-topic-${categoryId}`,
          postNumber: 1,
          postType: 1,
          userId: user.externalId,
          username: 'testuser',
          deleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          replyCount: 0,
          quoteCount: 0,
          incomingLinkCount: 0,
          reads: 0,
          readersCount: 0,
          score: 0,
          version: 1,
        })
        .execute();

      topics.push(topic);
    }

    // Test with category filtering for Arbitrum (categories 7 and 8 only)
    const result = await discourseRepository.getNewTopics(
      60, // timeframe in minutes
      discourse.id,
      [7, 8] // Arbitrum's allowed categories
    );

    // Verify only topics from categories 7 and 8 are returned
    expect(result).toHaveLength(2);
    expect(result.map((t) => t.categoryId).sort()).toEqual([7, 8]);
    expect(result.find((t) => t.categoryId === 10)).toBeUndefined();
  });

  it('should return all topics including category 10 for non-Arbitrum DAOs', async () => {
    const db = getTestDb();

    // Create test DAO
    const [dao] = await db
      .insertInto('dao')
      .values({
        name: 'Uniswap DAO',
        slug: 'uniswap',
        picture: 'https://example.com/uniswap.jpg',
      })
      .returning(['id'])
      .execute();

    // Create test discourse instance for a different DAO
    const [discourse] = await db
      .insertInto('daoDiscourse')
      .values({
        daoId: dao.id,
        discourseBaseUrl: 'https://forum.uniswap.org',
        enabled: true,
      })
      .returning(['id'])
      .execute();

    // Create discourse user
    const [user] = await db
      .insertInto('discourseUser')
      .values({
        daoDiscourseId: discourse.id,
        externalId: 2,
        username: 'uniswapuser',
        name: 'Uniswap User',
        avatarTemplate: 'avatar.png',
      })
      .returning(['id', 'externalId'])
      .execute();

    // Create topics in different categories including category 10
    const topics = [];
    for (const categoryId of [1, 5, 10]) {
      const [topic] = await db
        .insertInto('discourseTopic')
        .values({
          daoDiscourseId: discourse.id,
          externalId: categoryId * 200,
          title: `Uniswap Topic in Category ${categoryId}`,
          slug: `uniswap-topic-${categoryId}`,
          fancyTitle: `Uniswap Topic in Category ${categoryId}`,
          categoryId,
          archived: false,
          closed: false,
          pinned: false,
          pinnedGlobally: false,
          visible: true,
          postsCount: 1,
          replyCount: 0,
          likeCount: 0,
          views: 10,
          createdAt: new Date(),
          bumpedAt: new Date(),
          lastPostedAt: new Date(),
        })
        .returning(['id', 'externalId', 'categoryId'])
        .execute();

      // Create first post for each topic
      await db
        .insertInto('discoursePost')
        .values({
          daoDiscourseId: discourse.id,
          externalId: categoryId * 2000,
          topicId: topic.externalId,
          topicSlug: `uniswap-topic-${categoryId}`,
          postNumber: 1,
          postType: 1,
          userId: user.externalId,
          username: 'uniswapuser',
          deleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          replyCount: 0,
          quoteCount: 0,
          incomingLinkCount: 0,
          reads: 0,
          readersCount: 0,
          score: 0,
          version: 1,
        })
        .execute();

      topics.push(topic);
    }

    // Test without category filtering (undefined)
    const result = await discourseRepository.getNewTopics(
      60, // timeframe in minutes
      discourse.id,
      undefined // No category filtering for other DAOs
    );

    // Verify all topics are returned including category 10
    expect(result).toHaveLength(3);
    expect(result.map((t) => t.categoryId).sort((a, b) => a - b)).toEqual([
      1, 5, 10,
    ]);
  });
});
