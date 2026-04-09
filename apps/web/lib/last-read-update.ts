export type UpdateLastReadResult = 'updated' | 'ignored';

export interface UpdateLastReadDependencies {
  authenticate: (daoSlug: string) => Promise<string>;
  findScopedGroupId: (
    groupId: string,
    daoSlug: string
  ) => Promise<string | null>;
  upsertLastRead: (
    userId: string,
    groupId: string,
    now: Date
  ) => Promise<void>;
  revalidate: (userId: string, daoSlug: string) => void;
}

export async function updateLastReadForDao(
  dependencies: UpdateLastReadDependencies,
  input: {
    daoSlug: string;
    groupId: string;
    now: Date;
  }
): Promise<UpdateLastReadResult> {
  const userId = await dependencies.authenticate(input.daoSlug);
  const scopedGroupId = await dependencies.findScopedGroupId(
    input.groupId,
    input.daoSlug
  );

  if (!scopedGroupId) {
    return 'ignored';
  }

  await dependencies.upsertLastRead(userId, scopedGroupId, input.now);
  dependencies.revalidate(userId, input.daoSlug);

  return 'updated';
}
