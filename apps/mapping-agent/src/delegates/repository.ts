import {
  db,
  sql,
  type Dao,
  type DaoDiscourse,
  type Delegate,
  type DelegateToDiscourseUser,
  type DelegateToVoter,
  type DiscourseUser,
  type Selectable,
  type Voter,
} from '@proposalsapp/db';
import { recordDelegateDecision } from '../shared/audit';
import { isDryRunEnabled } from '../shared/dry-run';
import { resolveDelegateMappingWriteAction } from './write-guards';
import {
  buildDiscourseSeedCandidates,
  buildDelegateCases,
  type DelegateCase,
  type DelegateRecord,
  type DiscourseSeedCandidate,
  type DiscourseUserRecord,
  type VoterRecord,
} from './deterministic';
import {
  executeReadOnlySqlQuery,
  type ReadOnlySqlQueryResult,
  type ReadOnlySqlRelation,
} from '../shared/read-only-sql';

export interface DelegateWorkerContext {
  dao: Selectable<Dao>;
  daoDiscourse: Selectable<DaoDiscourse> | null;
  delegates: DelegateRecord[];
  discourseUsers: DiscourseUserRecord[];
  voters: VoterRecord[];
  proposalCategoryTopicExternalIds: number[];
  proposalCategoryPostCounts: Map<string, number>;
  historicalDelegateIdsByDiscourseUserId: Map<string, string[]>;
}

export interface DelegateQueryInput {
  sql: string;
}

export interface DelegateSeedResult {
  discourseUserId: string;
  outcome:
    | 'created'
    | 'created_dry_run'
    | 'repaired'
    | 'repaired_rejected'
    | 'skipped_ambiguous_history'
    | 'skipped_claimed';
  delegateId?: string;
  proposalCategoryPostCount: number;
  reason: string;
}

const ACTIVE_MAPPING_PERIOD_END = new Date('2100-01-01T00:00:00.000Z');

function mapDiscourseUserRecord(
  daoId: string,
  user: Selectable<DiscourseUser>
): DiscourseUserRecord {
  return {
    id: user.id,
    daoId,
    username: user.username,
    name: user.name,
  };
}

function mapVoterRecord(daoId: string, voter: Selectable<Voter>): VoterRecord {
  return {
    id: voter.id,
    daoId,
    address: voter.address,
    ens: voter.ens,
  };
}

function buildDelegateRecords(params: {
  delegates: Array<Selectable<Delegate>>;
  discourseMappings: Array<Selectable<DelegateToDiscourseUser>>;
  voterMappings: Array<Selectable<DelegateToVoter>>;
}): DelegateRecord[] {
  const discourseByDelegate = new Map<string, string[]>();
  const votersByDelegate = new Map<string, string[]>();

  for (const mapping of params.discourseMappings) {
    const ids = discourseByDelegate.get(mapping.delegateId) ?? [];
    ids.push(mapping.discourseUserId);
    discourseByDelegate.set(mapping.delegateId, ids);
  }

  for (const mapping of params.voterMappings) {
    const ids = votersByDelegate.get(mapping.delegateId) ?? [];
    ids.push(mapping.voterId);
    votersByDelegate.set(mapping.delegateId, ids);
  }

  return params.delegates.map((delegate) => ({
    id: delegate.id,
    daoId: delegate.daoId,
    discourseUserIds: [...new Set(discourseByDelegate.get(delegate.id) ?? [])],
    voterIds: [...new Set(votersByDelegate.get(delegate.id) ?? [])],
  }));
}

function buildHistoricalDelegateIdsByDiscourseUserId(
  mappings: Array<
    Pick<Selectable<DelegateToDiscourseUser>, 'delegateId' | 'discourseUserId'>
  >
): Map<string, string[]> {
  const historicalDelegateIdsByDiscourseUserId = new Map<string, string[]>();

  for (const mapping of mappings) {
    const existing =
      historicalDelegateIdsByDiscourseUserId.get(mapping.discourseUserId) ?? [];

    if (!existing.includes(mapping.delegateId)) {
      existing.push(mapping.delegateId);
      historicalDelegateIdsByDiscourseUserId.set(
        mapping.discourseUserId,
        existing
      );
    }
  }

  return historicalDelegateIdsByDiscourseUserId;
}

function buildProposalCategoryPostCounts(params: {
  discourseUsers: Array<Selectable<DiscourseUser>>;
  proposalCategoryPosts: Array<{ userId: number }>;
}): Map<string, number> {
  const discourseUserIdByExternalId = new Map<number, string>();
  const proposalCategoryPostCounts = new Map<string, number>();

  for (const discourseUser of params.discourseUsers) {
    discourseUserIdByExternalId.set(discourseUser.externalId, discourseUser.id);
  }

  for (const post of params.proposalCategoryPosts) {
    const discourseUserId = discourseUserIdByExternalId.get(post.userId);
    if (!discourseUserId) {
      continue;
    }

    proposalCategoryPostCounts.set(
      discourseUserId,
      (proposalCategoryPostCounts.get(discourseUserId) ?? 0) + 1
    );
  }

  return proposalCategoryPostCounts;
}

export async function loadDelegateWorkerContext(
  daoSlug: string,
  allowedCategoryIds: number[]
): Promise<DelegateWorkerContext | null> {
  const dao = await db
    .selectFrom('dao')
    .selectAll()
    .where('slug', '=', daoSlug)
    .executeTakeFirst();

  if (!dao) {
    return null;
  }

  const daoDiscourse = await db
    .selectFrom('daoDiscourse')
    .selectAll()
    .where('daoId', '=', dao.id)
    .executeTakeFirst();

  const delegates = await db
    .selectFrom('delegate')
    .selectAll()
    .where('daoId', '=', dao.id)
    .execute();

  const delegateIds = delegates.map((delegate) => delegate.id);
  const now = new Date();

  const [activeDiscourseMappings, allDiscourseMappings, voterMappings] =
    await Promise.all([
      delegateIds.length > 0
        ? db
            .selectFrom('delegateToDiscourseUser')
            .selectAll()
            .where('delegateId', 'in', delegateIds)
            .where('periodEnd', '>=', now)
            .execute()
        : Promise.resolve([] as Array<Selectable<DelegateToDiscourseUser>>),
      delegateIds.length > 0
        ? db
            .selectFrom('delegateToDiscourseUser')
            .select(['delegateId', 'discourseUserId'])
            .where('delegateId', 'in', delegateIds)
            .execute()
        : Promise.resolve(
            [] as Array<
              Pick<
                Selectable<DelegateToDiscourseUser>,
                'delegateId' | 'discourseUserId'
              >
            >
          ),
      delegateIds.length > 0
        ? db
            .selectFrom('delegateToVoter')
            .selectAll()
            .where('delegateId', 'in', delegateIds)
            .where('periodEnd', '>=', now)
            .execute()
        : Promise.resolve([] as Array<Selectable<DelegateToVoter>>),
    ]);

  const discourseUserIds = [
    ...new Set(
      activeDiscourseMappings.map((mapping) => mapping.discourseUserId)
    ),
  ];
  const voterIds = [
    ...new Set(voterMappings.map((mapping) => mapping.voterId)),
  ];

  const [
    discourseUsers,
    allDiscourseUsers,
    mappedVoters,
    relevantVoters,
    proposalCategoryTopics,
    proposalCategoryPosts,
  ] = await Promise.all([
    daoDiscourse && discourseUserIds.length > 0
      ? db
          .selectFrom('discourseUser')
          .selectAll()
          .where('daoDiscourseId', '=', daoDiscourse.id)
          .where('id', 'in', discourseUserIds)
          .execute()
      : Promise.resolve([] as Array<Selectable<DiscourseUser>>),
    daoDiscourse
      ? db
          .selectFrom('discourseUser')
          .selectAll()
          .where('daoDiscourseId', '=', daoDiscourse.id)
          .execute()
      : Promise.resolve([] as Array<Selectable<DiscourseUser>>),
    voterIds.length > 0
      ? db.selectFrom('voter').selectAll().where('id', 'in', voterIds).execute()
      : Promise.resolve([] as Array<Selectable<Voter>>),
    sql<Selectable<Voter>>`${sql.raw(buildRelevantVoterLookupSql(dao.id))}`
      .execute(db)
      .then((result) => result.rows),
    daoDiscourse && allowedCategoryIds.length > 0
      ? db
          .selectFrom('discourseTopic')
          .select(['externalId'])
          .where('daoDiscourseId', '=', daoDiscourse.id)
          .where('categoryId', 'in', allowedCategoryIds)
          .execute()
      : Promise.resolve([] as Array<{ externalId: number }>),
    daoDiscourse && allowedCategoryIds.length > 0
      ? db
          .selectFrom('discoursePost')
          .select(['userId'])
          .where('daoDiscourseId', '=', daoDiscourse.id)
          .where(
            'topicId',
            'in',
            db
              .selectFrom('discourseTopic')
              .select('externalId')
              .where('daoDiscourseId', '=', daoDiscourse.id)
              .where('categoryId', 'in', allowedCategoryIds)
          )
          .execute()
      : Promise.resolve([] as Array<{ userId: number }>),
  ]);

  const votersById = new Map<string, Selectable<Voter>>();
  for (const voter of [...mappedVoters, ...relevantVoters]) {
    votersById.set(voter.id, voter);
  }

  return {
    dao,
    daoDiscourse: daoDiscourse ?? null,
    delegates: buildDelegateRecords({
      delegates,
      discourseMappings: activeDiscourseMappings,
      voterMappings,
    }),
    discourseUsers: [
      ...new Map(
        [...discourseUsers, ...allDiscourseUsers].map((user) => [
          user.id,
          mapDiscourseUserRecord(dao.id, user),
        ])
      ).values(),
    ],
    voters: [...votersById.values()].map((voter) =>
      mapVoterRecord(dao.id, voter)
    ),
    proposalCategoryTopicExternalIds: proposalCategoryTopics.map(
      (topic) => topic.externalId
    ),
    proposalCategoryPostCounts: buildProposalCategoryPostCounts({
      discourseUsers: allDiscourseUsers,
      proposalCategoryPosts,
    }),
    historicalDelegateIdsByDiscourseUserId:
      buildHistoricalDelegateIdsByDiscourseUserId(allDiscourseMappings),
  };
}

async function loadDelegateWorkerContextByDaoId(
  daoId: string,
  allowedCategoryIds: number[] = []
): Promise<DelegateWorkerContext | null> {
  const dao = await db
    .selectFrom('dao')
    .select(['slug'])
    .where('id', '=', daoId)
    .executeTakeFirst();

  if (!dao) {
    return null;
  }

  return loadDelegateWorkerContext(dao.slug, allowedCategoryIds);
}

function getActiveClaimedTargetIds(
  delegates: DelegateRecord[],
  currentDelegateId: string
): {
  discourseUserIds: Set<string>;
  voterIds: Set<string>;
} {
  const discourseUserIds = new Set<string>();
  const voterIds = new Set<string>();

  for (const delegate of delegates) {
    if (delegate.id === currentDelegateId) {
      continue;
    }

    for (const discourseUserId of delegate.discourseUserIds) {
      discourseUserIds.add(discourseUserId);
    }

    for (const voterId of delegate.voterIds) {
      voterIds.add(voterId);
    }
  }

  return { discourseUserIds, voterIds };
}

function findCurrentDelegateCase(
  delegates: DelegateRecord[],
  delegateId: string
): DelegateCase | null {
  return (
    buildDelegateCases(delegates).find(
      (currentCase) => currentCase.delegateId === delegateId
    ) ?? null
  );
}

function exactVoterMatch(
  sourceUser: DiscourseUserRecord,
  voters: VoterRecord[]
): VoterRecord | null {
  const username = sourceUser.username.trim().toLowerCase();
  const matches = voters.filter(
    (voter) => voter.ens?.split('.')[0]?.trim().toLowerCase() === username
  );

  return matches.length === 1 ? matches[0]! : null;
}

function exactDiscourseUserMatch(
  sourceVoter: VoterRecord,
  discourseUsers: DiscourseUserRecord[]
): DiscourseUserRecord | null {
  const ensStem = sourceVoter.ens?.split('.')[0]?.trim().toLowerCase();
  if (!ensStem) {
    return null;
  }

  const matches = discourseUsers.filter(
    (user) => user.username.trim().toLowerCase() === ensStem
  );

  return matches.length === 1 ? matches[0]! : null;
}

async function createDelegateForDiscourseSeed(input: {
  daoId: string;
  discourseUserId: string;
  proposalCategoryPostCount: number;
  reason: string;
  evidenceIds: string[];
}): Promise<{
  accepted: boolean;
  delegateId?: string;
  conflictingDelegateId?: string;
  message: string;
}> {
  const now = new Date();
  const proof = {
    source: 'mapping-agent',
    decisionSource: 'deterministic',
    confidence: 1,
    reason: input.reason,
    evidenceIds: input.evidenceIds,
    seedType: 'proposal-category-activity',
    proposalCategoryPostCount: input.proposalCategoryPostCount,
  };

  if (isDryRunEnabled()) {
    return {
      accepted: true,
      delegateId: `dry-run-seed:${input.discourseUserId}`,
      message:
        'Dry run: delegate would be created and linked to discourse user',
    };
  }

  const result = await db.transaction().execute(async (trx) => {
    const lockedTarget = await trx
      .selectFrom('discourseUser as discourseUser')
      .innerJoin(
        'daoDiscourse as daoDiscourse',
        'daoDiscourse.id',
        'discourseUser.daoDiscourseId'
      )
      .select(['discourseUser.id'])
      .where('discourseUser.id', '=', input.discourseUserId)
      .where('daoDiscourse.daoId', '=', input.daoId)
      .forUpdate()
      .executeTakeFirst();

    if (!lockedTarget) {
      throw new Error(`Discourse user ${input.discourseUserId} not found`);
    }

    const activeTargetMappings = await trx
      .selectFrom('delegateToDiscourseUser as delegateToDiscourseUser')
      .innerJoin(
        'delegate as delegate',
        'delegate.id',
        'delegateToDiscourseUser.delegateId'
      )
      .select(['delegateToDiscourseUser.delegateId'])
      .where(
        'delegateToDiscourseUser.discourseUserId',
        '=',
        input.discourseUserId
      )
      .where('delegateToDiscourseUser.periodEnd', '>=', now)
      .where('delegate.daoId', '=', input.daoId)
      .forUpdate()
      .execute();

    const nextDecision = resolveDelegateMappingWriteAction({
      delegateId: '__delegate_seed__',
      targetId: input.discourseUserId,
      activeTargetIdsForDelegate: [],
      activeDelegateIdsForTarget: activeTargetMappings.map(
        (mapping) => mapping.delegateId
      ),
    });

    if (nextDecision.kind !== 'insert') {
      return {
        accepted: false,
        conflictingDelegateId: activeTargetMappings[0]?.delegateId,
        message: 'Discourse user already claimed',
      };
    }

    const insertedDelegate = await trx
      .insertInto('delegate')
      .values({
        daoId: input.daoId,
      })
      .returning(['id'])
      .executeTakeFirstOrThrow();

    await trx
      .insertInto('delegateToDiscourseUser')
      .values({
        delegateId: insertedDelegate.id,
        discourseUserId: input.discourseUserId,
        createdAt: now,
        periodStart: now,
        periodEnd: ACTIVE_MAPPING_PERIOD_END,
        proof,
        verified: false,
      })
      .execute();

    return {
      accepted: true,
      delegateId: insertedDelegate.id,
      message: 'Delegate created and linked to discourse user',
    };
  });

  if (result.accepted && result.delegateId) {
    await recordDelegateDecision({
      daoId: input.daoId,
      delegateId: result.delegateId,
      mappingType: 'delegate_to_discourse_user',
      targetDiscourseUserId: input.discourseUserId,
      decisionSource: 'deterministic',
      accepted: true,
      declined: false,
      confidence: 1,
      reason: input.reason,
      evidenceIds: input.evidenceIds,
      metadata: {
        seedType: 'proposal-category-activity',
        proposalCategoryPostCount: input.proposalCategoryPostCount,
      },
    });
  } else {
    if (result.conflictingDelegateId) {
      await recordDelegateDecision({
        daoId: input.daoId,
        delegateId: result.conflictingDelegateId,
        mappingType: 'delegate_to_discourse_user',
        targetDiscourseUserId: input.discourseUserId,
        decisionSource: 'deterministic',
        accepted: false,
        declined: true,
        confidence: 1,
        reason: `${input.reason}. Skipped because the discourse user is already claimed.`,
        evidenceIds: input.evidenceIds,
        metadata: {
          seedType: 'proposal-category-activity',
          proposalCategoryPostCount: input.proposalCategoryPostCount,
        },
      });
    }
  }

  return result;
}

async function runDeterministicDelegateSeeding(input: {
  context: DelegateWorkerContext;
  confidenceThreshold: number;
}): Promise<DelegateSeedResult[]> {
  const candidates = buildDiscourseSeedCandidates({
    discourseUsers: input.context.discourseUsers,
    proposalCategoryPostCounts: input.context.proposalCategoryPostCounts,
    delegates: input.context.delegates,
    historicalDelegateIdsByDiscourseUserId:
      input.context.historicalDelegateIdsByDiscourseUserId,
  });
  const results: DelegateSeedResult[] = [];

  for (const candidate of candidates) {
    results.push(
      await applyDiscourseSeedCandidate({
        context: input.context,
        candidate,
        confidenceThreshold: input.confidenceThreshold,
      })
    );
  }

  return results;
}

async function applyDiscourseSeedCandidate(input: {
  context: DelegateWorkerContext;
  candidate: DiscourseSeedCandidate;
  confidenceThreshold: number;
}): Promise<DelegateSeedResult> {
  const reasonBase = `Discourse user exceeded 10 total posts on proposal-category topics (${input.candidate.proposalCategoryPostCount})`;
  const evidenceIds = [
    input.candidate.discourseUserId,
    ...input.candidate.historicalDelegateIds,
  ];

  if (input.candidate.ambiguousHistoricalDelegateIds?.length) {
    await recordDelegateDecision({
      daoId: input.context.dao.id,
      delegateId: input.candidate.ambiguousHistoricalDelegateIds[0]!,
      mappingType: 'delegate_to_discourse_user',
      decisionSource: 'deterministic',
      accepted: false,
      declined: true,
      confidence: 1,
      reason: `${reasonBase}. Skipped because multiple historical delegates exist for this discourse user.`,
      evidenceIds,
      metadata: {
        seedType: 'proposal-category-activity',
        proposalCategoryPostCount: input.candidate.proposalCategoryPostCount,
        ambiguousHistoricalDelegateIds:
          input.candidate.ambiguousHistoricalDelegateIds,
      },
    });
    return {
      discourseUserId: input.candidate.discourseUserId,
      outcome: 'skipped_ambiguous_history',
      proposalCategoryPostCount: input.candidate.proposalCategoryPostCount,
      reason: `${reasonBase}. Multiple historical delegates exist for this discourse user.`,
    };
  }

  if (input.candidate.repairDelegateId) {
    const result = await proposeDelegateMapping({
      daoId: input.context.dao.id,
      delegateId: input.candidate.repairDelegateId,
      mappingType: 'delegate_to_discourse_user',
      targetId: input.candidate.discourseUserId,
      confidence: 1,
      threshold: input.confidenceThreshold,
      reason: `${reasonBase}. Restored discourse mapping for the single historical delegate.`,
      evidenceIds,
      decisionSource: 'deterministic',
    });
    return {
      discourseUserId: input.candidate.discourseUserId,
      delegateId: input.candidate.repairDelegateId,
      outcome: result.accepted ? 'repaired' : 'repaired_rejected',
      proposalCategoryPostCount: input.candidate.proposalCategoryPostCount,
      reason: result.message,
    };
  }

  const result = await createDelegateForDiscourseSeed({
    daoId: input.context.dao.id,
    discourseUserId: input.candidate.discourseUserId,
    proposalCategoryPostCount: input.candidate.proposalCategoryPostCount,
    reason: `${reasonBase}. Created delegate from discourse activity.`,
    evidenceIds,
  });

  return {
    discourseUserId: input.candidate.discourseUserId,
    delegateId: result.delegateId ?? result.conflictingDelegateId,
    outcome: result.accepted
      ? isDryRunEnabled()
        ? 'created_dry_run'
        : 'created'
      : 'skipped_claimed',
    proposalCategoryPostCount: input.candidate.proposalCategoryPostCount,
    reason: result.message,
  };
}

export async function runDeterministicDelegateMappings(input: {
  daoSlug: string;
  confidenceThreshold: number;
  allowedCategoryIds: number[];
}): Promise<{
  context: DelegateWorkerContext | null;
  unresolvedCases: DelegateCase[];
  seedResults: DelegateSeedResult[];
}> {
  const context = await loadDelegateWorkerContext(
    input.daoSlug,
    input.allowedCategoryIds
  );
  if (!context) {
    return { context: null, unresolvedCases: [], seedResults: [] };
  }

  const seedResults = await runDeterministicDelegateSeeding({
    context,
    confidenceThreshold: input.confidenceThreshold,
  });

  const activeContext =
    (await loadDelegateWorkerContext(
      input.daoSlug,
      input.allowedCategoryIds
    )) ?? context;

  const claimedTargetIds = getActiveClaimedTargetIds(
    activeContext.delegates,
    ''
  );
  const unresolvedCases: DelegateCase[] = [];

  for (const currentCase of buildDelegateCases(activeContext.delegates)) {
    if (currentCase.missingSide === 'voter') {
      const sourceUser = activeContext.discourseUsers.find(
        (user) => user.id === currentCase.sourceDiscourseUserId
      );

      if (!sourceUser) {
        unresolvedCases.push(currentCase);
        continue;
      }

      const exactMatch = exactVoterMatch(
        sourceUser,
        activeContext.voters.filter(
          (voter) => !claimedTargetIds.voterIds.has(voter.id)
        )
      );

      if (!exactMatch) {
        unresolvedCases.push(currentCase);
        continue;
      }

      await proposeDelegateMapping({
        daoId: context.dao.id,
        // activeContext and context refer to the same DAO
        delegateId: currentCase.delegateId,
        mappingType: 'delegate_to_voter',
        targetId: exactMatch.id,
        confidence: 1,
        threshold: input.confidenceThreshold,
        reason:
          'Deterministic exact match between discourse username and voter ENS stem',
        evidenceIds: [sourceUser.id, exactMatch.id],
        decisionSource: 'deterministic',
      });
      claimedTargetIds.voterIds.add(exactMatch.id);
    } else {
      const sourceVoter = activeContext.voters.find(
        (voter) => voter.id === currentCase.sourceVoterId
      );

      if (!sourceVoter) {
        unresolvedCases.push(currentCase);
        continue;
      }

      const exactMatch = exactDiscourseUserMatch(
        sourceVoter,
        activeContext.discourseUsers.filter(
          (user) => !claimedTargetIds.discourseUserIds.has(user.id)
        )
      );

      if (!exactMatch) {
        unresolvedCases.push(currentCase);
        continue;
      }

      await proposeDelegateMapping({
        daoId: context.dao.id,
        delegateId: currentCase.delegateId,
        mappingType: 'delegate_to_discourse_user',
        targetId: exactMatch.id,
        confidence: 1,
        threshold: input.confidenceThreshold,
        reason:
          'Deterministic exact match between voter ENS stem and discourse username',
        evidenceIds: [sourceVoter.id, exactMatch.id],
        decisionSource: 'deterministic',
      });
      claimedTargetIds.discourseUserIds.add(exactMatch.id);
    }
  }

  return { context: activeContext, unresolvedCases, seedResults };
}

function quoteSqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export function buildRelevantVoterLookupSql(daoId: string): string {
  const daoIdLiteral = quoteSqlLiteral(daoId);

  return `SELECT v.*
FROM voter v
JOIN (
  SELECT voter AS address
  FROM voting_power_latest
  WHERE dao_id = ${daoIdLiteral}
  UNION
  SELECT voter_address AS address
  FROM vote
  WHERE dao_id = ${daoIdLiteral}
) relevant_addresses
  ON relevant_addresses.address = v.address`;
}

function buildDelegateQueryRelations(params: {
  delegateId: string;
  allowedCategoryIds: number[];
}): ReadOnlySqlRelation[] {
  const allowedCategorySql =
    params.allowedCategoryIds.length > 0
      ? params.allowedCategoryIds.join(', ')
      : null;

  return [
    {
      name: 'current_case',
      sql: `SELECT
  d.id AS delegate_id,
  d.dao_id AS dao_id,
  dao.slug AS dao_slug,
  dao.name AS dao_name,
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM delegate_to_discourse_user map
      WHERE map.delegate_id = d.id
        AND map.period_end >= CURRENT_TIMESTAMP
    )
    AND NOT EXISTS (
      SELECT 1
      FROM delegate_to_voter map
      WHERE map.delegate_id = d.id
        AND map.period_end >= CURRENT_TIMESTAMP
    ) THEN 'voter'
    WHEN NOT EXISTS (
      SELECT 1
      FROM delegate_to_discourse_user map
      WHERE map.delegate_id = d.id
        AND map.period_end >= CURRENT_TIMESTAMP
    )
    AND EXISTS (
      SELECT 1
      FROM delegate_to_voter map
      WHERE map.delegate_id = d.id
        AND map.period_end >= CURRENT_TIMESTAMP
    ) THEN 'discourse_user'
    ELSE NULL
  END AS missing_side,
  (
    SELECT map.discourse_user_id
    FROM delegate_to_discourse_user map
    WHERE map.delegate_id = d.id
      AND map.period_end >= CURRENT_TIMESTAMP
    ORDER BY map.period_start DESC, map.created_at DESC
    LIMIT 1
  ) AS source_discourse_user_id,
  (
    SELECT map.voter_id
    FROM delegate_to_voter map
    WHERE map.delegate_id = d.id
      AND map.period_end >= CURRENT_TIMESTAMP
    ORDER BY map.period_start DESC, map.created_at DESC
    LIMIT 1
  ) AS source_voter_id
FROM delegate d
JOIN dao ON dao.id = d.dao_id
WHERE d.id = ${quoteSqlLiteral(params.delegateId)}`,
    },
    {
      name: 'daos',
      sql: `SELECT id, slug, name
FROM dao`,
    },
    {
      name: 'dao_discourses',
      sql: `SELECT
  id,
  dao_id,
  discourse_base_url
FROM dao_discourse`,
    },
    {
      name: 'delegates',
      sql: `SELECT id, dao_id
FROM delegate`,
    },
    {
      name: 'discourse_users',
      sql: `SELECT
  du.id,
  dd.dao_id AS dao_id,
  du.dao_discourse_id,
  du.external_id,
  du.username,
  du.name,
  du.title,
  du.topic_count,
  du.post_count,
  du.likes_received,
  du.likes_given
FROM discourse_user du
JOIN dao_discourse dd ON dd.id = du.dao_discourse_id`,
    },
    {
      name: 'voters',
      sql: `SELECT
  id,
  address,
  ens,
  updated_at
FROM voter`,
    },
    {
      name: 'delegate_to_discourse_users',
      sql: `SELECT
  id,
  delegate_id,
  discourse_user_id,
  period_start,
  period_end,
  verified,
  created_at,
  proof
FROM delegate_to_discourse_user`,
    },
    {
      name: 'delegate_to_voters',
      sql: `SELECT
  id,
  delegate_id,
  voter_id,
  period_start,
  period_end,
  verified,
  created_at,
  proof
FROM delegate_to_voter`,
    },
    {
      name: 'active_delegate_to_discourse_users',
      sql: `SELECT *
FROM delegate_to_discourse_users
WHERE period_end >= CURRENT_TIMESTAMP`,
    },
    {
      name: 'active_delegate_to_voters',
      sql: `SELECT *
FROM delegate_to_voters
WHERE period_end >= CURRENT_TIMESTAMP`,
    },
    {
      name: 'current_delegate_discourse_users',
      sql: `SELECT
  map.delegate_id,
  map.discourse_user_id,
  user_row.dao_id,
  user_row.username,
  user_row.name,
  user_row.title
FROM active_delegate_to_discourse_users map
JOIN discourse_users user_row ON user_row.id = map.discourse_user_id
WHERE map.delegate_id = ${quoteSqlLiteral(params.delegateId)}`,
    },
    {
      name: 'current_delegate_voters',
      sql: `SELECT
  map.delegate_id,
  map.voter_id,
  voter_row.address,
  voter_row.ens
FROM active_delegate_to_voters map
JOIN voters voter_row ON voter_row.id = map.voter_id
WHERE map.delegate_id = ${quoteSqlLiteral(params.delegateId)}`,
    },
    {
      name: 'proposal_category_topics',
      sql: `SELECT
  dt.id,
  dt.external_id,
  dt.dao_discourse_id,
  dd.dao_id,
  dt.title,
  dt.category_id
FROM discourse_topic dt
JOIN dao_discourse dd ON dd.id = dt.dao_discourse_id
JOIN current_case cc ON cc.dao_id = dd.dao_id
WHERE ${allowedCategorySql ? `dt.category_id IN (${allowedCategorySql})` : 'FALSE'}`,
    },
    {
      name: 'proposal_category_post_counts',
      sql: `SELECT
  du.id AS discourse_user_id,
  COUNT(*)::bigint AS proposal_category_post_count
FROM discourse_post dp
JOIN discourse_user du
  ON du.external_id = dp.user_id
 AND du.dao_discourse_id = dp.dao_discourse_id
WHERE dp.topic_id IN (SELECT external_id FROM proposal_category_topics)
GROUP BY du.id`,
    },
    {
      name: 'current_delegate_proposal_category_posts',
      sql: `SELECT
  dp.external_id,
  dp.topic_id,
  dp.created_at,
  dp.post_number,
  dp.username,
  dp.user_id
FROM discourse_post dp
JOIN discourse_user du
  ON du.external_id = dp.user_id
 AND du.dao_discourse_id = dp.dao_discourse_id
JOIN current_delegate_discourse_users cdd
  ON cdd.discourse_user_id = du.id
WHERE dp.topic_id IN (SELECT external_id FROM proposal_category_topics)
ORDER BY dp.created_at DESC`,
    },
    {
      name: 'votes',
      sql: `SELECT
  id,
  dao_id,
  governor_id,
  proposal_id,
  proposal_external_id,
  voter_address,
  created_at,
  voting_power,
  reason
FROM vote`,
    },
    {
      name: 'voting_power_timeseries',
      sql: `SELECT
  id,
  dao_id,
  voter,
  timestamp,
  voting_power,
  block,
  txid
FROM voting_power_timeseries`,
    },
  ];
}

export async function queryDelegateMappingData(params: {
  daoId: string;
  delegateId: string;
  allowedCategoryIds: number[];
  input: DelegateQueryInput;
}): Promise<ReadOnlySqlQueryResult> {
  const result = await executeReadOnlySqlQuery({
    query: params.input.sql,
    relations: buildDelegateQueryRelations({
      delegateId: params.delegateId,
      allowedCategoryIds: params.allowedCategoryIds,
    }),
  });

  return result;
}

export async function proposeDelegateMapping(input: {
  daoId: string;
  delegateId: string;
  mappingType: 'delegate_to_discourse_user' | 'delegate_to_voter';
  targetId: string;
  confidence: number;
  threshold: number;
  reason: string;
  evidenceIds: string[];
  decisionSource: 'deterministic' | 'agent';
}): Promise<{ accepted: boolean; message: string }> {
  const context = await loadDelegateWorkerContextByDaoId(input.daoId);
  if (!context) {
    throw new Error(`DAO ${input.daoId} not found`);
  }

  const delegate = context.delegates.find(
    (candidate) => candidate.id === input.delegateId
  );
  if (!delegate) {
    throw new Error(`Delegate ${input.delegateId} not found`);
  }

  if (input.confidence < input.threshold) {
    await recordDelegateDecision({
      daoId: input.daoId,
      delegateId: input.delegateId,
      mappingType: input.mappingType,
      decisionSource: input.decisionSource,
      accepted: false,
      declined: false,
      confidence: input.confidence,
      reason: `Rejected delegate mapping below threshold ${input.threshold}. ${input.reason}`,
      evidenceIds: input.evidenceIds,
      ...(input.mappingType === 'delegate_to_discourse_user'
        ? { targetDiscourseUserId: input.targetId }
        : { targetVoterId: input.targetId }),
    });
    return { accepted: false, message: 'Confidence below threshold' };
  }

  const now = new Date();
  const proof = {
    source: 'mapping-agent',
    decisionSource: input.decisionSource,
    confidence: input.confidence,
    reason: input.reason,
    evidenceIds: input.evidenceIds,
  };

  if (input.mappingType === 'delegate_to_discourse_user') {
    const target = context.discourseUsers.find(
      (user) => user.id === input.targetId
    );
    if (!target) {
      throw new Error(`Discourse user ${input.targetId} not found`);
    }

    const decision = isDryRunEnabled()
      ? resolveDelegateMappingWriteAction({
          delegateId: input.delegateId,
          targetId: target.id,
          activeTargetIdsForDelegate: delegate.discourseUserIds,
          activeDelegateIdsForTarget: Array.from(
            getActiveClaimedTargetIds(
              context.delegates,
              input.delegateId
            ).discourseUserIds.has(target.id)
              ? ['claimed-by-other-delegate']
              : []
          ),
        })
      : await db.transaction().execute(async (trx) => {
          const lockedDelegate = await trx
            .selectFrom('delegate')
            .select(['id'])
            .where('id', '=', input.delegateId)
            .where('daoId', '=', input.daoId)
            .forUpdate()
            .executeTakeFirst();

          if (!lockedDelegate) {
            throw new Error(`Delegate ${input.delegateId} not found`);
          }

          const lockedTarget = await trx
            .selectFrom('discourseUser as discourseUser')
            .innerJoin(
              'daoDiscourse as daoDiscourse',
              'daoDiscourse.id',
              'discourseUser.daoDiscourseId'
            )
            .select(['discourseUser.id'])
            .where('discourseUser.id', '=', target.id)
            .where('daoDiscourse.daoId', '=', input.daoId)
            .forUpdate()
            .executeTakeFirst();

          if (!lockedTarget) {
            throw new Error(`Discourse user ${input.targetId} not found`);
          }

          const [delegateMappings, targetMappings] = await Promise.all([
            trx
              .selectFrom('delegateToDiscourseUser')
              .select(['delegateId', 'discourseUserId'])
              .where('delegateId', '=', input.delegateId)
              .where('periodEnd', '>=', now)
              .forUpdate()
              .execute(),
            trx
              .selectFrom('delegateToDiscourseUser')
              .select(['delegateId', 'discourseUserId'])
              .where('discourseUserId', '=', target.id)
              .where('periodEnd', '>=', now)
              .forUpdate()
              .execute(),
          ]);

          const nextDecision = resolveDelegateMappingWriteAction({
            delegateId: input.delegateId,
            targetId: target.id,
            activeTargetIdsForDelegate: delegateMappings.map(
              (mapping) => mapping.discourseUserId
            ),
            activeDelegateIdsForTarget: targetMappings.map(
              (mapping) => mapping.delegateId
            ),
          });

          if (nextDecision.kind === 'insert') {
            await trx
              .insertInto('delegateToDiscourseUser')
              .values({
                delegateId: input.delegateId,
                discourseUserId: target.id,
                createdAt: now,
                periodStart: now,
                periodEnd: ACTIVE_MAPPING_PERIOD_END,
                proof,
                verified: false,
              })
              .execute();
          }

          return nextDecision;
        });

    if (decision.kind === 'reject_delegate_conflict') {
      await recordDelegateDecision({
        daoId: input.daoId,
        delegateId: input.delegateId,
        mappingType: input.mappingType,
        targetDiscourseUserId: target.id,
        decisionSource: input.decisionSource,
        accepted: false,
        declined: false,
        confidence: input.confidence,
        reason: `Rejected delegate mapping: delegate already has an active discourse user mapping. ${input.reason}`,
        evidenceIds: input.evidenceIds,
      });
      return { accepted: false, message: 'Delegate already mapped elsewhere' };
    }

    if (decision.kind === 'reject_target_claimed') {
      await recordDelegateDecision({
        daoId: input.daoId,
        delegateId: input.delegateId,
        mappingType: input.mappingType,
        targetDiscourseUserId: target.id,
        decisionSource: input.decisionSource,
        accepted: false,
        declined: false,
        confidence: input.confidence,
        reason: `Rejected delegate mapping: discourse user is already claimed by another delegate. ${input.reason}`,
        evidenceIds: input.evidenceIds,
      });
      return { accepted: false, message: 'Discourse user already claimed' };
    }

    await recordDelegateDecision({
      daoId: input.daoId,
      delegateId: input.delegateId,
      mappingType: input.mappingType,
      targetDiscourseUserId: target.id,
      decisionSource: input.decisionSource,
      accepted: true,
      declined: false,
      confidence: input.confidence,
      reason: input.reason,
      evidenceIds: input.evidenceIds,
    });

    return {
      accepted: true,
      message: isDryRunEnabled()
        ? 'Dry run: delegate would be mapped to discourse user'
        : 'Delegate mapped to discourse user',
    };
  }

  const target = context.voters.find((voter) => voter.id === input.targetId);
  if (!target) {
    throw new Error(`Voter ${input.targetId} not found`);
  }

  const decision = isDryRunEnabled()
    ? resolveDelegateMappingWriteAction({
        delegateId: input.delegateId,
        targetId: target.id,
        activeTargetIdsForDelegate: delegate.voterIds,
        activeDelegateIdsForTarget: Array.from(
          getActiveClaimedTargetIds(
            context.delegates,
            input.delegateId
          ).voterIds.has(target.id)
            ? ['claimed-by-other-delegate']
            : []
        ),
      })
    : await db.transaction().execute(async (trx) => {
        const lockedDelegate = await trx
          .selectFrom('delegate')
          .select(['id'])
          .where('id', '=', input.delegateId)
          .where('daoId', '=', input.daoId)
          .forUpdate()
          .executeTakeFirst();

        if (!lockedDelegate) {
          throw new Error(`Delegate ${input.delegateId} not found`);
        }

        const lockedTarget = await trx
          .selectFrom('voter')
          .select(['id'])
          .where('id', '=', target.id)
          .where((eb) =>
            eb.or([
              eb(
                'address',
                'in',
                db
                  .selectFrom('votingPowerTimeseries as votingPowerTimeseries')
                  .select('votingPowerTimeseries.voter')
                  .where('votingPowerTimeseries.daoId', '=', input.daoId)
              ),
              eb(
                'address',
                'in',
                db
                  .selectFrom('vote as vote')
                  .select('vote.voterAddress')
                  .where('vote.daoId', '=', input.daoId)
              ),
            ])
          )
          .forUpdate()
          .executeTakeFirst();

        if (!lockedTarget) {
          throw new Error(`Voter ${input.targetId} not found`);
        }

        const [delegateMappings, targetMappings] = await Promise.all([
          trx
            .selectFrom('delegateToVoter')
            .select(['delegateId', 'voterId'])
            .where('delegateId', '=', input.delegateId)
            .where('periodEnd', '>=', now)
            .forUpdate()
            .execute(),
          trx
            .selectFrom('delegateToVoter as delegateToVoter')
            .innerJoin(
              'delegate as delegate',
              'delegate.id',
              'delegateToVoter.delegateId'
            )
            .select(['delegateToVoter.delegateId', 'delegateToVoter.voterId'])
            .where('delegateToVoter.voterId', '=', target.id)
            .where('delegateToVoter.periodEnd', '>=', now)
            .where('delegate.daoId', '=', input.daoId)
            .forUpdate()
            .execute(),
        ]);

        const nextDecision = resolveDelegateMappingWriteAction({
          delegateId: input.delegateId,
          targetId: target.id,
          activeTargetIdsForDelegate: delegateMappings.map(
            (mapping) => mapping.voterId
          ),
          activeDelegateIdsForTarget: targetMappings.map(
            (mapping) => mapping.delegateId
          ),
        });

        if (nextDecision.kind === 'insert') {
          await trx
            .insertInto('delegateToVoter')
            .values({
              delegateId: input.delegateId,
              voterId: target.id,
              createdAt: now,
              periodStart: now,
              periodEnd: ACTIVE_MAPPING_PERIOD_END,
              proof,
              verified: false,
            })
            .execute();
        }

        return nextDecision;
      });

  if (decision.kind === 'reject_delegate_conflict') {
    await recordDelegateDecision({
      daoId: input.daoId,
      delegateId: input.delegateId,
      mappingType: input.mappingType,
      targetVoterId: target.id,
      decisionSource: input.decisionSource,
      accepted: false,
      declined: false,
      confidence: input.confidence,
      reason: `Rejected delegate mapping: delegate already has an active voter mapping. ${input.reason}`,
      evidenceIds: input.evidenceIds,
    });
    return { accepted: false, message: 'Delegate already mapped elsewhere' };
  }

  if (decision.kind === 'reject_target_claimed') {
    await recordDelegateDecision({
      daoId: input.daoId,
      delegateId: input.delegateId,
      mappingType: input.mappingType,
      targetVoterId: target.id,
      decisionSource: input.decisionSource,
      accepted: false,
      declined: false,
      confidence: input.confidence,
      reason: `Rejected delegate mapping: voter is already claimed by another delegate. ${input.reason}`,
      evidenceIds: input.evidenceIds,
    });
    return { accepted: false, message: 'Voter already claimed' };
  }

  await recordDelegateDecision({
    daoId: input.daoId,
    delegateId: input.delegateId,
    mappingType: input.mappingType,
    targetVoterId: target.id,
    decisionSource: input.decisionSource,
    accepted: true,
    declined: false,
    confidence: input.confidence,
    reason: input.reason,
    evidenceIds: input.evidenceIds,
  });

  return {
    accepted: true,
    message: isDryRunEnabled()
      ? 'Dry run: delegate would be mapped to voter'
      : 'Delegate mapped to voter',
  };
}

export async function declineDelegateMapping(input: {
  daoId: string;
  delegateId: string;
  reason: string;
  evidenceIds?: string[];
  decisionSource: 'deterministic' | 'agent';
}): Promise<void> {
  const currentCase = await loadDelegateWorkerContextByDaoId(input.daoId);
  const delegateCase = currentCase
    ? findCurrentDelegateCase(currentCase.delegates, input.delegateId)
    : null;

  await recordDelegateDecision({
    daoId: input.daoId,
    delegateId: input.delegateId,
    mappingType:
      delegateCase?.missingSide === 'voter'
        ? 'delegate_to_voter'
        : 'delegate_to_discourse_user',
    decisionSource: input.decisionSource,
    accepted: false,
    declined: true,
    reason: input.reason,
    evidenceIds: input.evidenceIds ?? [],
  });
}
