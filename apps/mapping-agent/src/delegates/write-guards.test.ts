import { describe, expect, it } from 'vitest';
import { resolveDelegateMappingWriteAction } from './write-guards';

describe('resolveDelegateMappingWriteAction', () => {
  it('treats an existing active pair as idempotent', () => {
    expect(
      resolveDelegateMappingWriteAction({
        delegateId: 'delegate-1',
        targetId: 'target-1',
        activeTargetIdsForDelegate: ['target-1'],
        activeDelegateIdsForTarget: ['delegate-1'],
      })
    ).toEqual({
      kind: 'idempotent',
    });
  });

  it('rejects a second active target for the same delegate', () => {
    expect(
      resolveDelegateMappingWriteAction({
        delegateId: 'delegate-1',
        targetId: 'target-2',
        activeTargetIdsForDelegate: ['target-1'],
        activeDelegateIdsForTarget: [],
      })
    ).toEqual({
      conflictingId: 'target-1',
      kind: 'reject_delegate_conflict',
    });
  });

  it('rejects a target that is already claimed by another delegate', () => {
    expect(
      resolveDelegateMappingWriteAction({
        delegateId: 'delegate-1',
        targetId: 'target-1',
        activeTargetIdsForDelegate: [],
        activeDelegateIdsForTarget: ['delegate-2'],
      })
    ).toEqual({
      conflictingId: 'delegate-2',
      kind: 'reject_target_claimed',
    });
  });

  it('requires confirmation before sharing a claimed target', () => {
    expect(
      resolveDelegateMappingWriteAction({
        delegateId: 'delegate-1',
        targetId: 'target-1',
        activeTargetIdsForDelegate: [],
        activeDelegateIdsForTarget: ['delegate-2', 'delegate-3'],
        allowSharedTarget: true,
      })
    ).toEqual({
      conflictingIds: ['delegate-2', 'delegate-3'],
      kind: 'confirm_target_claimed',
    });
  });

  it('allows a confirmed shared target insert', () => {
    expect(
      resolveDelegateMappingWriteAction({
        delegateId: 'delegate-1',
        targetId: 'target-1',
        activeTargetIdsForDelegate: [],
        activeDelegateIdsForTarget: ['delegate-2'],
        allowSharedTarget: true,
        confirmTargetClaimed: true,
      })
    ).toEqual({
      kind: 'insert',
    });
  });

  it('allows an insert when neither side is actively claimed', () => {
    expect(
      resolveDelegateMappingWriteAction({
        delegateId: 'delegate-1',
        targetId: 'target-1',
        activeTargetIdsForDelegate: [],
        activeDelegateIdsForTarget: [],
      })
    ).toEqual({
      kind: 'insert',
    });
  });
});
