const DEFAULT_HURRY_REMAINING_MS = 60_000;
const DEFAULT_HURRY_QUERY_WINDOW = 5;

export interface QueryBudgetConfig {
  startedAtMs: number;
  timeoutMs: number;
  maxQueryCalls: number;
  minQueryCallsBeforeDecision: number;
  queryToolName: string;
  decisionToolNames: string[];
  hurryRemainingMs?: number;
  hurryQueryWindow?: number;
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
  const remainingMs = Math.max(0, config.timeoutMs - elapsedMs);
  const queryCallsRemaining = Math.max(0, config.maxQueryCalls - queryCount);
  const minQueriesRemaining = Math.max(
    0,
    config.minQueryCallsBeforeDecision - queryCount
  );
  const hurryRemainingMs =
    config.hurryRemainingMs ?? DEFAULT_HURRY_REMAINING_MS;
  const hurryQueryWindow =
    config.hurryQueryWindow ?? DEFAULT_HURRY_QUERY_WINDOW;

  return {
    queryCount,
    minQueriesRemaining,
    queryCallsRemaining,
    elapsedMs,
    remainingMs,
    isHurryPhase:
      queryCallsRemaining <= hurryQueryWindow ||
      remainingMs <= hurryRemainingMs,
    isDecisionOnly:
      queryCount >= config.maxQueryCalls || elapsedMs >= config.timeoutMs,
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
  snapshot: QueryBudgetSnapshot
): string | null {
  if (!snapshot.isHurryPhase && !snapshot.isDecisionOnly) {
    return null;
  }

  const parts: string[] = [];

  if (snapshot.isDecisionOnly) {
    parts.push(
      'You have already passed the target search budget. Prefer making a decision now. Only make another read if it is absolutely necessary and tightly scoped.'
    );
  }

  if (snapshot.queryCallsRemaining <= DEFAULT_HURRY_QUERY_WINDOW) {
    if (snapshot.queryCallsRemaining > 0) {
      parts.push(
        `Only ${snapshot.queryCallsRemaining} read queries remain before you are beyond the target query budget.`
      );
    } else {
      parts.push('You are already beyond the target query budget.');
    }
  }

  if (snapshot.remainingMs <= DEFAULT_HURRY_REMAINING_MS) {
    if (snapshot.remainingMs > 0) {
      parts.push(
        `Only about ${Math.ceil(snapshot.remainingMs / 1000)} seconds remain before you are beyond the target time budget.`
      );
    } else {
      parts.push('You are already beyond the target time budget.');
    }
  }

  parts.push('Hurry up and finish the case.');
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
