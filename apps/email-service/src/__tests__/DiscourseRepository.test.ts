import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DiscourseRepository } from '../repositories/DiscourseRepository';
import { sql } from '@proposalsapp/db';

describe('DiscourseRepository', () => {
  let mockDb: any;
  let discourseRepository: DiscourseRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    
    const mockExecute = vi.fn();
    const mockWhere = vi.fn().mockReturnThis();
    const mockSelectAll = vi.fn().mockReturnThis();
    const mockSelect = vi.fn().mockReturnThis();
    const mockSelectFrom = vi.fn().mockReturnThis();
    const mockInnerJoin = vi.fn().mockReturnThis();
    const mock$if = vi.fn().mockReturnThis();

    mockSelectFrom.mockImplementation(() => ({
      innerJoin: mockInnerJoin,
      selectAll: mockSelectAll,
      select: mockSelect,
      where: mockWhere,
      $if: mock$if,
      execute: mockExecute,
    }));

    mockInnerJoin.mockImplementation(() => ({
      innerJoin: mockInnerJoin,
      selectAll: mockSelectAll,
      select: mockSelect,
      where: mockWhere,
      $if: mock$if,
      execute: mockExecute,
    }));

    mockSelectAll.mockImplementation(() => ({
      select: mockSelect,
      where: mockWhere,
      $if: mock$if,
      execute: mockExecute,
    }));

    mockSelect.mockImplementation(() => ({
      where: mockWhere,
      $if: mock$if,
      execute: mockExecute,
    }));

    mockWhere.mockImplementation(() => ({
      where: mockWhere,
      $if: mock$if,
      execute: mockExecute,
    }));

    mock$if.mockImplementation(() => ({
      execute: mockExecute,
    }));

    mockDb = {
      selectFrom: mockSelectFrom,
    } as any;

    discourseRepository = new DiscourseRepository(mockDb);
  });

  describe('getNewTopics', () => {
    const mockTopicData = [
      {
        id: 'topic-1',
        externalId: 1,
        title: 'Test Topic',
        slug: 'test-topic',
        fancyTitle: 'Test Topic',
        categoryId: 7,
        daoDiscourseId: 'dao-discourse-1',
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
        'discourseUser.daoDiscourseId': 'dao-discourse-1',
        'discourseUser.title': null,
        'discourseUser.likesGiven': null,
        'discourseUser.likesReceived': null,
        'discourseUser.daysVisited': null,
        'discourseUser.postsRead': null,
        'discourseUser.topicsEntered': null,
        'discourseUser.postCount': null,
        'discourseUser.topicCount': null,
      },
    ];

    it('should fetch new topics without category filtering', async () => {
      const mockExecute = vi.fn().mockResolvedValue(mockTopicData);
      const mock$if = vi.fn().mockImplementation((condition, callback) => {
        return {
          execute: mockExecute,
        };
      });

      mockDb.selectFrom = vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnThis(),
        selectAll: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        $if: mock$if,
        execute: mockExecute,
      });

      const result = await discourseRepository.getNewTopics(
        5,
        'dao-discourse-1'
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('topic-1');
      expect(result[0].categoryId).toBe(7);
      expect(result[0].discourseUser.username).toBe('testuser');
      
      // Verify $if was called with false condition for category filtering
      expect(mock$if).toHaveBeenCalledWith(
        false, // undefined && undefined.length > 0 = false
        expect.any(Function)
      );
    });

    it('should fetch new topics with category filtering', async () => {
      const mockExecute = vi.fn().mockResolvedValue(mockTopicData);
      const mockWhereIn = vi.fn().mockReturnThis();
      const mock$if = vi.fn().mockImplementation((condition, callback) => {
        if (condition) {
          // Simulate the callback being executed
          const mockQb = { where: mockWhereIn };
          callback(mockQb);
        }
        return {
          execute: mockExecute,
        };
      });

      mockDb.selectFrom = vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnThis(),
        selectAll: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        $if: mock$if,
        execute: mockExecute,
      });

      const allowedCategories = [7, 8];
      const result = await discourseRepository.getNewTopics(
        5,
        'dao-discourse-1',
        allowedCategories
      );

      expect(result).toHaveLength(1);
      
      // Verify $if was called with true condition for category filtering
      expect(mock$if).toHaveBeenCalledWith(
        true, // allowedCategories !== undefined && allowedCategories.length > 0
        expect.any(Function)
      );
      
      // Verify the where clause for categories was called
      expect(mockWhereIn).toHaveBeenCalledWith(
        'discourseTopic.categoryId',
        'in',
        allowedCategories
      );
    });

    it('should return empty array when no topics found', async () => {
      const mockExecute = vi.fn().mockResolvedValue([]);
      
      mockDb.selectFrom = vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnThis(),
        selectAll: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        $if: vi.fn().mockReturnThis(),
        execute: mockExecute,
      });

      const result = await discourseRepository.getNewTopics(
        5,
        'dao-discourse-1'
      );

      expect(result).toEqual([]);
    });

    it('should handle empty category array as no filtering', async () => {
      const mockExecute = vi.fn().mockResolvedValue(mockTopicData);
      const mock$if = vi.fn().mockImplementation((condition, callback) => {
        return {
          execute: mockExecute,
        };
      });

      mockDb.selectFrom = vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnThis(),
        selectAll: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        $if: mock$if,
        execute: mockExecute,
      });

      const result = await discourseRepository.getNewTopics(
        5,
        'dao-discourse-1',
        [] // Empty array should not filter
      );

      expect(result).toHaveLength(1);
      
      // Verify $if was called with false condition (empty array)
      expect(mock$if).toHaveBeenCalledWith(
        false, // [] !== undefined && [].length > 0 = false
        expect.any(Function)
      );
    });

    it('should handle database errors gracefully', async () => {
      const mockError = new Error('Database connection failed');
      const mockExecute = vi.fn().mockRejectedValue(mockError);
      
      mockDb.selectFrom = vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnThis(),
        selectAll: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        $if: vi.fn().mockReturnThis(),
        execute: mockExecute,
      });

      await expect(
        discourseRepository.getNewTopics(5, 'dao-discourse-1')
      ).rejects.toThrow('Database connection failed');
    });
  });
});