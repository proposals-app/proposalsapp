const DEFAULT_SOFT_TIME_BUDGET_MS = 300_000;
const DEFAULT_HURRY_QUERY_THRESHOLD = 20;

export interface QueryBudgetConfig {
  startedAtMs: number;
  timeoutMs: number;
  maxQueryCalls: number;
  minQueryCallsBeforeDecision: number;
  queryToolName: string;
  decisionToolNames: string[];
  hurryAfterQueryCalls?: number;
  softTimeBudgetMs?: number;
}

export interface QueryBudgetSnapshot {
  queryCount: number;
  minQueriesRemaining: number;
  queryCallsRemaining: number;
  elapsedMs: number;
  remainingMs: number;
  isHurryPhase: boolean;
  isDecisionOnly: boolean;
}

export function getQueryBudgetSnapshot(
  config: QueryBudgetConfig,
  queryCount: number
): QueryBudgetSnapshot {
  const elapsedMs = Math.max(0, Date.now() - config.startedAtMs);
  const softTimeBudgetMs =
    config.softTimeBudgetMs ?? config.timeoutMs ?? DEFAULT_SOFT_TIME_BUDGET_MS;
  const remainingMs = Math.max(0, softTimeBudgetMs - elapsedMs);
  const queryCallsRemaining = Math.max(0, config.maxQueryCalls - queryCount);
  const minQueriesRemaining = Math.max(
    0,
    config.minQueryCallsBeforeDecision - queryCount
  );
  const hurryAfterQueryCalls =
    config.hurryAfterQueryCalls ?? DEFAULT_HURRY_QUERY_THRESHOLD;

  return {
    queryCount,
    minQueriesRemaining,
    queryCallsRemaining,
    elapsedMs,
    remainingMs,
    isHurryPhase:
      queryCount >= hurryAfterQueryCalls || elapsedMs >= softTimeBudgetMs,
    isDecisionOnly: queryCount >= config.maxQueryCalls,
  };
}

export function serializeQueryBudget(
  snapshot: QueryBudgetSnapshot
): Record<string, unknown> {
  return {
    queryCount: snapshot.queryCount,
    minQueriesRemaining: snapshot.minQueriesRemaining,
    queryCallsRemaining: snapshot.queryCallsRemaining,
    elapsedMs: snapshot.elapsedMs,
    remainingMs: snapshot.remainingMs,
    isHurryPhase: snapshot.isHurryPhase,
    isDecisionOnly: snapshot.isDecisionOnly,
  };
}

export function buildHurryMessage(
  config: QueryBudgetConfig,
  snapshot: QueryBudgetSnapshot
): string | null {
  if (!snapshot.isHurryPhase && !snapshot.isDecisionOnly) {
    return null;
  }

  const parts: string[] = [];
  const hurryAfterQueryCalls =
    config.hurryAfterQueryCalls ?? DEFAULT_HURRY_QUERY_THRESHOLD;
  const softTimeBudgetMs =
    config.softTimeBudgetMs ?? config.timeoutMs ?? DEFAULT_SOFT_TIME_BUDGET_MS;

  if (snapshot.isDecisionOnly) {
    parts.push(
      `You have reached the maximum read budget of ${config.maxQueryCalls} queries. Further read queries will not be accepted. Make a decision now instead of continuing to search.`
    );
  }

  if (snapshot.queryCount >= hurryAfterQueryCalls) {
    parts.push(
      `You have already used ${snapshot.queryCount} read queries and are past the target search budget of ${hurryAfterQueryCalls} reads.`
    );
  }

  if (snapshot.elapsedMs >= softTimeBudgetMs) {
    parts.push(
      `You have already spent about ${Math.ceil(
        snapshot.elapsedMs / 1000
      )} seconds on this case and are past the target time budget of ${Math.ceil(
        softTimeBudgetMs / 1000
      )} seconds.`
    );
  }

  parts.push(
    'Prefer making a decision now unless one more tightly scoped read is genuinely necessary.'
  );
  return parts.join(' ');
}

export function buildMinQueryError(
  config: QueryBudgetConfig,
  snapshot: QueryBudgetSnapshot
): Record<string, unknown> {
  return {
    ok: false,
    error: `You must make at least ${config.minQueryCallsBeforeDecision} ${config.queryToolName} calls before a decision tool is allowed.`,
    budget: serializeQueryBudget(snapshot),
  };
}
