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
    }
  | {
      kind: 'confirm_target_claimed';
      conflictingIds: string[];
    };

export function resolveDelegateMappingWriteAction(input: {
  delegateId: string;
  targetId: string;
  activeTargetIdsForDelegate: string[];
  activeDelegateIdsForTarget: string[];
  allowSharedTarget?: boolean;
  confirmTargetClaimed?: boolean;
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

  const conflictingTargetDelegateIds = input.activeDelegateIdsForTarget.filter(
    (delegateId) => delegateId !== input.delegateId
  );
  if (conflictingTargetDelegateIds.length > 0) {
    if (input.allowSharedTarget) {
      if (input.confirmTargetClaimed) {
        return {
          kind: 'insert',
        };
      }

      return {
        kind: 'confirm_target_claimed',
        conflictingIds: conflictingTargetDelegateIds,
      };
    }

    return {
      kind: 'reject_target_claimed',
      conflictingId: conflictingTargetDelegateIds[0]!,
    };
  }

  return {
    kind: 'insert',
  };
}
