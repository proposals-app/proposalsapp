import type { ReadOnlySqlQueryResult } from './read-only-sql';

const MAX_QUERY_RESULT_ROWS = 60;
const MAX_QUERY_RESULT_CHARS = 150_000;

export function buildOversizedQueryResultFeedback(params: {
  sql: string;
  result: ReadOnlySqlQueryResult;
  budget: Record<string, unknown>;
  warning?: string | null;
}): Record<string, unknown> | null {
  const responseChars = JSON.stringify(params.result.rows).length;
  const tooManyRows = params.result.rowCount > MAX_QUERY_RESULT_ROWS;
  const tooManyChars = responseChars > MAX_QUERY_RESULT_CHARS;

  if (!tooManyRows && !tooManyChars) {
    return null;
  }

  const reasons: string[] = [];
  if (tooManyRows) {
    reasons.push(
      `it returned ${params.result.rowCount} rows (limit the result to at most ${MAX_QUERY_RESULT_ROWS})`
    );
  }
  if (tooManyChars) {
    reasons.push(
      `the serialized row payload is ${responseChars} characters (keep it under ${MAX_QUERY_RESULT_CHARS})`
    );
  }

  const guidanceParts = [
    'Use LIMIT and narrower WHERE clauses before retrying.',
    'Select fewer columns first, then fetch exact details only for the rows you still need.',
  ];

  if (/\bcooked\b/i.test(params.sql)) {
    guidanceParts.push(
      'Do not request discourse_post.cooked across all posts by a user or topic; fetch cooked only for one exact post, one exact topic first post, or a very small LIMIT after a metadata or breadcrumb scan.'
    );
  }

  return {
    ok: false,
    error: `This query succeeded but the result is too large to forward safely because ${reasons.join(
      ' and '
    )}. Narrow the query and try again.`,
    attemptedSql: params.sql,
    rowCount: params.result.rowCount,
    responseChars,
    guidance: guidanceParts.join(' '),
    budget: params.budget,
    ...(params.warning ? { warning: params.warning } : {}),
  };
}
