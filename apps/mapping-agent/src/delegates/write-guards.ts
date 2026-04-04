export type DelegateMappingWriteAction =
  | {
      kind: 'insert';
    }
  | {
      kind: 'idempotent';
    }
  | {
      kind: 'reject_delegate_conflict';
      conflictingId: string;
    }
  | {
      kind: 'reject_target_claimed';
      conflictingId: string;
    };

export function resolveDelegateMappingWriteAction(input: {
  delegateId: string;
  targetId: string;
  activeTargetIdsForDelegate: string[];
  activeDelegateIdsForTarget: string[];
}): DelegateMappingWriteAction {
  if (input.activeTargetIdsForDelegate.includes(input.targetId)) {
    return {
      kind: 'idempotent',
    };
  }

  const conflictingDelegateTargetId = input.activeTargetIdsForDelegate.find(
    (targetId) => targetId !== input.targetId
  );
  if (conflictingDelegateTargetId) {
    return {
      kind: 'reject_delegate_conflict',
      conflictingId: conflictingDelegateTargetId,
    };
  }

  const conflictingTargetDelegateId = input.activeDelegateIdsForTarget.find(
    (delegateId) => delegateId !== input.delegateId
  );
  if (conflictingTargetDelegateId) {
    return {
      kind: 'reject_target_claimed',
      conflictingId: conflictingTargetDelegateId,
    };
  }

  return {
    kind: 'insert',
  };
}
