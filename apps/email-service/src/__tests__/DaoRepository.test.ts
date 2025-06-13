import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Kysely } from 'kysely';
import type { DB } from '@proposalsapp/db';
import { DaoRepository } from '../repositories/DaoRepository';

describe('DaoRepository', () => {
  let mockDb: jest.Mocked<Kysely<DB>>;
  let daoRepository: DaoRepository;

  beforeEach(() => {
    const mockExecute = vi.fn();
    const mockExecuteTakeFirst = vi.fn();
    const mockWhere = vi.fn().mockReturnThis();
    const mockSelect = vi.fn().mockReturnThis();
    const mockSelectAll = vi.fn().mockReturnThis();
    const mockSelectFrom = vi.fn().mockReturnThis();

    mockSelectFrom.mockImplementation(() => ({
      selectAll: mockSelectAll,
      where: mockWhere,
      execute: mockExecute,
      executeTakeFirst: mockExecuteTakeFirst,
    }));

    mockSelectAll.mockImplementation(() => ({
      where: mockWhere,
      execute: mockExecute,
      executeTakeFirst: mockExecuteTakeFirst,
    }));

    mockWhere.mockImplementation(() => ({
      execute: mockExecute,
      executeTakeFirst: mockExecuteTakeFirst,
      where: mockWhere,
    }));

    mockDb = {
      selectFrom: mockSelectFrom,
    } as any;

    daoRepository = new DaoRepository(mockDb);
  });

  describe('getDaoBySlug', () => {
    it('should return a DAO when found by slug', async () => {
      const mockDao = {
        id: 'dao-1',
        name: 'Test DAO',
        slug: 'test-dao',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockExecuteTakeFirst = vi.fn().mockResolvedValue(mockDao);
      const mockWhere = vi.fn().mockReturnValue({
        executeTakeFirst: mockExecuteTakeFirst,
      });
      const mockSelectAll = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      
      mockDb.selectFrom.mockReturnValue({
        selectAll: mockSelectAll,
      } as any);

      const result = await daoRepository.getDaoBySlug('test-dao');

      expect(result).toEqual(mockDao);
      expect(mockDb.selectFrom).toHaveBeenCalledWith('dao');
      expect(mockSelectAll).toHaveBeenCalled();
      expect(mockWhere).toHaveBeenCalledWith('slug', '=', 'test-dao');
      expect(mockExecuteTakeFirst).toHaveBeenCalled();
    });

    it('should return undefined when DAO not found', async () => {
      const mockExecuteTakeFirst = vi.fn().mockResolvedValue(undefined);
      const mockWhere = vi.fn().mockReturnValue({
        executeTakeFirst: mockExecuteTakeFirst,
      });
      const mockSelectAll = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      
      mockDb.selectFrom.mockReturnValue({
        selectAll: mockSelectAll,
      } as any);

      const result = await daoRepository.getDaoBySlug('non-existent-dao');

      expect(result).toBeUndefined();
      expect(mockDb.selectFrom).toHaveBeenCalledWith('dao');
      expect(mockSelectAll).toHaveBeenCalled();
      expect(mockWhere).toHaveBeenCalledWith('slug', '=', 'non-existent-dao');
      expect(mockExecuteTakeFirst).toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      const mockError = new Error('Database connection failed');
      const mockExecuteTakeFirst = vi.fn().mockRejectedValue(mockError);
      const mockWhere = vi.fn().mockReturnValue({
        executeTakeFirst: mockExecuteTakeFirst,
      });
      const mockSelectAll = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      
      mockDb.selectFrom.mockReturnValue({
        selectAll: mockSelectAll,
      } as any);

      await expect(daoRepository.getDaoBySlug('test-dao')).rejects.toThrow('Database connection failed');
    });
  });
});