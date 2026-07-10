import { describe, expect, it } from 'vitest';
import { mappingRequestSchema } from './api-contract';

const daoId = '11111111-1111-4111-8111-111111111111';
const groupId = '22222222-2222-4222-8222-222222222222';
const governorId = '33333333-3333-4333-8333-333333333333';

describe('mappingRequestSchema', () => {
  it('normalizes group timestamps at the route interface', () => {
    const result = mappingRequestSchema.parse({
      operation: 'groups.save',
      groups: [
        {
          id: groupId,
          name: 'Governance group',
          daoId,
          createdAt: '2026-07-10T12:00:00.000Z',
          items: [
            {
              type: 'proposal',
              name: 'Proposal',
              externalId: 'proposal-1',
              governorId,
            },
          ],
        },
      ],
    });

    expect(result.operation).toBe('groups.save');
    if (result.operation === 'groups.save') {
      expect(result.groups[0].createdAt).toEqual(
        new Date('2026-07-10T12:00:00.000Z')
      );
    }
  });

  it('rejects invalid identifiers before database access', () => {
    expect(() =>
      mappingRequestSchema.parse({
        operation: 'delegates.delete',
        delegateId: 'not-a-uuid',
      })
    ).toThrow();
  });

  it('bounds exclusion lists', () => {
    expect(() =>
      mappingRequestSchema.parse({
        operation: 'delegates.searchVoters',
        query: 'alice',
        excludeIds: Array.from({ length: 501 }, () => groupId),
      })
    ).toThrow();
  });
});
