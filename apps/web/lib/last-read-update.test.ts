import { describe, expect, it, vi } from 'vitest';
import { updateLastReadForDao } from './last-read-update';

describe('updateLastReadForDao', () => {
  it('writes the last-read timestamp only for groups inside the active dao', async () => {
    const authenticate = vi.fn(async () => 'user-1');
    const findScopedGroupId = vi.fn(async () => 'group-1');
    const upsertLastRead = vi.fn(async () => undefined);
    const revalidate = vi.fn();
    const now = new Date('2026-04-09T12:00:00.000Z');

    const result = await updateLastReadForDao(
      {
        authenticate,
        findScopedGroupId,
        upsertLastRead,
        revalidate,
      },
      {
        daoSlug: 'arbitrum',
        groupId: 'group-1',
        now,
      }
    );

    expect(result).toBe('updated');
    expect(authenticate).toHaveBeenCalledWith('arbitrum');
    expect(findScopedGroupId).toHaveBeenCalledWith('group-1', 'arbitrum');
    expect(upsertLastRead).toHaveBeenCalledWith('user-1', 'group-1', now);
    expect(revalidate).toHaveBeenCalledWith('user-1', 'arbitrum');
  });

  it('skips the write when the group does not belong to the requested dao', async () => {
    const authenticate = vi.fn(async () => 'user-1');
    const findScopedGroupId = vi.fn(async () => null);
    const upsertLastRead = vi.fn(async () => undefined);
    const revalidate = vi.fn();

    const result = await updateLastReadForDao(
      {
        authenticate,
        findScopedGroupId,
        upsertLastRead,
        revalidate,
      },
      {
        daoSlug: 'arbitrum',
        groupId: 'group-2',
        now: new Date('2026-04-09T12:00:00.000Z'),
      }
    );

    expect(result).toBe('ignored');
    expect(upsertLastRead).not.toHaveBeenCalled();
    expect(revalidate).not.toHaveBeenCalled();
  });

  it('does not swallow authentication failures', async () => {
    const authError = new Error('Authentication required');

    await expect(
      updateLastReadForDao(
        {
          authenticate: vi.fn(async () => {
            throw authError;
          }),
          findScopedGroupId: vi.fn(async () => 'group-1'),
          upsertLastRead: vi.fn(async () => undefined),
          revalidate: vi.fn(),
        },
        {
          daoSlug: 'arbitrum',
          groupId: 'group-1',
          now: new Date('2026-04-09T12:00:00.000Z'),
        }
      )
    ).rejects.toThrow('Authentication required');
  });
});
