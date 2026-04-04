import { describe, expect, it } from 'vitest';
import {
  appendProposalGroupItemIfMissing,
  normalizeStoredGroupItems,
} from './group-items';

describe('normalizeStoredGroupItems', () => {
  it('normalizes a valid stored items array', () => {
    expect(
      normalizeStoredGroupItems([
        {
          type: 'topic',
          name: 'Topic',
          external_id: '123',
          dao_discourse_id: 'dao-discourse-1',
        },
        {
          type: 'proposal',
          name: 'Proposal',
          externalId: 'proposal-1',
          governorId: 'governor-1',
        },
      ])
    ).toEqual([
      {
        type: 'topic',
        name: 'Topic',
        externalId: '123',
        daoDiscourseId: 'dao-discourse-1',
      },
      {
        type: 'proposal',
        name: 'Proposal',
        externalId: 'proposal-1',
        governorId: 'governor-1',
      },
    ]);
  });

  it('treats a legacy empty object payload as an empty list', () => {
    expect(normalizeStoredGroupItems({})).toEqual([]);
  });

  it('rejects malformed non-array values that are not the legacy empty object', () => {
    expect(() => normalizeStoredGroupItems({ unexpected: true })).toThrow(
      'Stored proposal group items must be an array'
    );
  });

  it('appends a missing proposal item', () => {
    const result = appendProposalGroupItemIfMissing(
      [
        {
          type: 'topic',
          name: 'Topic',
          externalId: '123',
          daoDiscourseId: 'dao-discourse-1',
        },
      ],
      {
        name: 'Proposal',
        externalId: 'proposal-1',
        governorId: 'governor-1',
      }
    );

    expect(result).toEqual({
      appended: true,
      items: [
        {
          type: 'topic',
          name: 'Topic',
          externalId: '123',
          daoDiscourseId: 'dao-discourse-1',
        },
        {
          type: 'proposal',
          name: 'Proposal',
          externalId: 'proposal-1',
          governorId: 'governor-1',
        },
      ],
    });
  });

  it('does not append a duplicate proposal item', () => {
    const result = appendProposalGroupItemIfMissing(
      [
        {
          type: 'proposal',
          name: 'Proposal',
          externalId: 'proposal-1',
          governorId: 'governor-1',
        },
      ],
      {
        name: 'Renamed proposal',
        externalId: 'proposal-1',
        governorId: 'governor-1',
      }
    );

    expect(result).toEqual({
      appended: false,
      items: [
        {
          type: 'proposal',
          name: 'Proposal',
          externalId: 'proposal-1',
          governorId: 'governor-1',
        },
      ],
    });
  });
});
