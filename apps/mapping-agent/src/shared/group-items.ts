export type ProposalGroupItem =
  | {
      type: 'topic';
      name: string;
      externalId: string;
      daoDiscourseId: string;
    }
  | {
      type: 'proposal';
      name: string;
      externalId: string;
      governorId: string;
    };

export type StoredProposalGroupItem =
  | {
      type: 'topic';
      name: string;
      externalId?: string;
      external_id?: string;
      daoDiscourseId?: string;
      dao_discourse_id?: string;
    }
  | {
      type: 'proposal';
      name: string;
      externalId?: string;
      external_id?: string;
      governorId?: string;
      governor_id?: string;
    };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function normalizeStoredGroupItems(items: unknown): ProposalGroupItem[] {
  if (items === null || items === undefined) {
    return [];
  }

  if (Array.isArray(items)) {
    return items.map((item) =>
      normalizeStoredGroupItem(item as StoredProposalGroupItem)
    );
  }

  // Legacy rows may contain `{}` instead of `[]` for empty groups.
  if (isPlainObject(items) && Object.keys(items).length === 0) {
    return [];
  }

  throw new Error('Stored proposal group items must be an array');
}

export function getTopicItemKey(item: {
  externalId: string;
  daoDiscourseId: string;
}): string {
  return `${item.daoDiscourseId}:${item.externalId}`;
}

export function getProposalItemKey(item: {
  externalId: string;
  governorId: string;
}): string {
  return `${item.governorId}:${item.externalId}`;
}

export function appendProposalGroupItemIfMissing(
  items: ProposalGroupItem[],
  proposal: {
    name: string;
    externalId: string;
    governorId: string;
  }
): {
  items: ProposalGroupItem[];
  appended: boolean;
} {
  const proposalKey = getProposalItemKey(proposal);
  const alreadyPresent = items.some(
    (item) =>
      item.type === 'proposal' && getProposalItemKey(item) === proposalKey
  );

  if (alreadyPresent) {
    return {
      items,
      appended: false,
    };
  }

  return {
    items: [
      ...items,
      {
        type: 'proposal',
        name: proposal.name,
        externalId: proposal.externalId,
        governorId: proposal.governorId,
      },
    ],
    appended: true,
  };
}

export function normalizeStoredGroupItem(
  item: StoredProposalGroupItem | ProposalGroupItem
): ProposalGroupItem {
  if (item.type === 'topic') {
    const externalId =
      item.externalId ?? ('external_id' in item ? item.external_id : undefined);
    const daoDiscourseId =
      item.daoDiscourseId ??
      ('dao_discourse_id' in item ? item.dao_discourse_id : undefined);

    if (!externalId || !daoDiscourseId) {
      throw new Error('Stored topic group item is missing identifiers');
    }

    return {
      type: 'topic',
      name: item.name,
      externalId,
      daoDiscourseId,
    };
  }

  const externalId =
    item.externalId ?? ('external_id' in item ? item.external_id : undefined);
  const governorId =
    item.governorId ?? ('governor_id' in item ? item.governor_id : undefined);

  if (!externalId || !governorId) {
    throw new Error('Stored proposal group item is missing identifiers');
  }

  return {
    type: 'proposal',
    name: item.name,
    externalId,
    governorId,
  };
}
