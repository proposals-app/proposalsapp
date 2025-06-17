import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DiscourseRepository } from '../repositories/DiscourseRepository';

describe('DiscourseRepository - Category Filtering Integration', () => {
  let mockDb: any;
  let discourseRepository: DiscourseRepository;

  const createMockTopic = (id: string, categoryId: number) => ({
    id,
    externalId: parseInt(id.split('-')[1]),
    title: `Test Topic in Category ${categoryId}`,
    slug: `test-topic-${categoryId}`,
    fancyTitle: `Test Topic in Category ${categoryId}`,
    categoryId,
    daoDiscourseId: 'dao-discourse-arbitrum',
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
    'discourseUser.id': 'user-1',
    'discourseUser.externalId': 1,
    'discourseUser.username': 'testuser',
    'discourseUser.name': 'Test User',
    'discourseUser.avatarTemplate': 'avatar.png',
    'discourseUser.daoDiscourseId': 'dao-discourse-arbitrum',
    'discourseUser.title': null,
    'discourseUser.likesGiven': '10',
    'discourseUser.likesReceived': '20',
    'discourseUser.daysVisited': '30',
    'discourseUser.postsRead': '100',
    'discourseUser.topicsEntered': '50',
    'discourseUser.postCount': '25',
    'discourseUser.topicCount': '15',
  });

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockDb = {
      selectFrom: vi.fn(),
    } as any;

    discourseRepository = new DiscourseRepository(mockDb);
  });

  it('should filter out category 10 topics for Arbitrum even if they exist in database', async () => {
    // Mock database returning topics from categories 7, 8, and 10
    const mockTopicsFromDb = [
      createMockTopic('topic-1', 7),  // Should be included
      createMockTopic('topic-2', 8),  // Should be included
      createMockTopic('topic-3', 10), // Should be filtered out
    ];

    // Mock the query builder to simulate filtering
    const mockExecute = vi.fn().mockImplementation(async () => {
      // This simulates the actual database query with the WHERE IN clause
      return mockTopicsFromDb.filter(topic => [7, 8].includes(topic.categoryId));
    });

    const mockWhereIn = vi.fn().mockReturnThis();
    const mock$if = vi.fn().mockImplementation((condition, callback) => {
      if (condition) {
        const mockQb = { where: mockWhereIn };
        callback(mockQb);
        // Update the execute to filter based on categories
        mockExecute.mockImplementation(async () => {
          return mockTopicsFromDb.filter(topic => [7, 8].includes(topic.categoryId));
        });
      }
      return {
        execute: mockExecute,
      };
    });

    mockDb.selectFrom.mockReturnValue({
      innerJoin: vi.fn().mockReturnThis(),
      selectAll: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      $if: mock$if,
      execute: mockExecute,
    });

    const result = await discourseRepository.getNewTopics(
      5,
      'dao-discourse-arbitrum',
      [7, 8] // Arbitrum's allowed categories
    );

    // Verify only topics from categories 7 and 8 are returned
    expect(result).toHaveLength(2);
    expect(result.map(t => t.categoryId)).toEqual([7, 8]);
    expect(result.find(t => t.categoryId === 10)).toBeUndefined();
    
    // Verify the where clause was called with the correct categories
    expect(mockWhereIn).toHaveBeenCalledWith(
      'discourseTopic.categoryId',
      'in',
      [7, 8]
    );
  });

  it('should return all topics including category 10 for non-Arbitrum DAOs', async () => {
    // Mock database returning topics from various categories
    const mockTopicsFromDb = [
      createMockTopic('topic-1', 1),
      createMockTopic('topic-2', 5),
      createMockTopic('topic-3', 10),
    ];

    const mockExecute = vi.fn().mockResolvedValue(mockTopicsFromDb);
    const mock$if = vi.fn().mockImplementation((condition, callback) => {
      // Condition should be false (no category filtering)
      expect(condition).toBe(false);
      return {
        execute: mockExecute,
      };
    });

    mockDb.selectFrom.mockReturnValue({
      innerJoin: vi.fn().mockReturnThis(),
      selectAll: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      $if: mock$if,
      execute: mockExecute,
    });

    const result = await discourseRepository.getNewTopics(
      5,
      'dao-discourse-uniswap',
      undefined // No category filtering for other DAOs
    );

    // Verify all topics are returned including category 10
    expect(result).toHaveLength(3);
    expect(result.map(t => t.categoryId)).toEqual([1, 5, 10]);
  });
});