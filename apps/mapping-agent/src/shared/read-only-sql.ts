import { dbPool } from '@proposalsapp/db';

const MAX_SQL_LENGTH = 20_000;
const DEFAULT_RESULT_LIMIT = 100;
const DEFAULT_STATEMENT_TIMEOUT_MS = 10_000;
const IDENTIFIER_PATTERN = /^[a-z_][a-z0-9_]*$/;
const FORBIDDEN_SQL_TOKENS = [
  'insert',
  'update',
  'delete',
  'merge',
  'upsert',
  'create',
  'alter',
  'drop',
  'truncate',
  'grant',
  'revoke',
  'copy',
  'vacuum',
  'analyze',
  'comment',
  'execute',
  'prepare',
  'deallocate',
  'call',
  'do',
  'set',
  'reset',
  'lock',
  'begin',
  'commit',
  'rollback',
  'refresh',
];

export interface ReadOnlySqlRelation {
  name: string;
  sql: string;
}

export interface ReadOnlySqlQueryResult {
  rows: Record<string, unknown>[];
  rowCount: number;
}

function assertValidIdentifier(identifier: string, kind: string): void {
  if (!IDENTIFIER_PATTERN.test(identifier)) {
    throw new Error(`Invalid ${kind} identifier: ${identifier}`);
  }
}

function quoteLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export function normalizeReadOnlySql(query: string): string {
  const trimmed = query.trim();

  if (!trimmed) {
    throw new Error('Read-only SQL query is required');
  }

  if (trimmed.length > MAX_SQL_LENGTH) {
    throw new Error(`Read-only SQL query exceeds ${MAX_SQL_LENGTH} characters`);
  }

  const withoutTrailingSemicolon = trimmed.endsWith(';')
    ? trimmed.slice(0, -1).trimEnd()
    : trimmed;

  if (withoutTrailingSemicolon.includes(';')) {
    throw new Error('Read-only SQL tool accepts only a single statement');
  }

  if (!/^(select|with)\b/i.test(withoutTrailingSemicolon)) {
    throw new Error('Read-only SQL must start with SELECT or WITH');
  }

  const lowerCaseQuery = withoutTrailingSemicolon.toLowerCase();

  for (const token of FORBIDDEN_SQL_TOKENS) {
    if (new RegExp(`\\b${token}\\b`, 'i').test(lowerCaseQuery)) {
      throw new Error(`Read-only SQL cannot use ${token.toUpperCase()}`);
    }
  }

  return withoutTrailingSemicolon;
}

export function buildJsonReadOnlySqlRelation(params: {
  name: string;
  columns: Array<{
    name: string;
    pgType: string;
  }>;
  rows: ReadonlyArray<Record<string, unknown>>;
}): ReadOnlySqlRelation {
  assertValidIdentifier(params.name, 'relation');

  const columnDefinitions = params.columns
    .map((column) => {
      assertValidIdentifier(column.name, 'column');
      return `${column.name} ${column.pgType}`;
    })
    .join(', ');

  return {
    name: params.name,
    sql: `SELECT *
FROM jsonb_to_recordset(COALESCE(${quoteLiteral(JSON.stringify(params.rows))}::jsonb, '[]'::jsonb)) AS relation_row(${columnDefinitions})`,
  };
}

export function buildReadOnlySqlStatement(params: {
  query: string;
  relations?: ReadonlyArray<ReadOnlySqlRelation>;
  resultLimit?: number;
}): string {
  const normalizedQuery = normalizeReadOnlySql(params.query);
  const resultLimit = params.resultLimit ?? DEFAULT_RESULT_LIMIT;
  const relations = params.relations ?? [];

  for (const relation of relations) {
    assertValidIdentifier(relation.name, 'relation');
  }

  const relationCtes = relations.map(
    (relation) => `${relation.name} AS (\n${relation.sql.trim()}\n)`
  );
  const withClause =
    relationCtes.length > 0 ? `WITH\n${relationCtes.join(',\n')}\n` : '';

  return `${withClause}SELECT *
FROM (
${normalizedQuery}
) AS mapping_result
LIMIT ${resultLimit}`;
}

export async function executeReadOnlySqlQuery(params: {
  query: string;
  relations?: ReadonlyArray<ReadOnlySqlRelation>;
  resultLimit?: number;
  statementTimeoutMs?: number;
}): Promise<ReadOnlySqlQueryResult> {
  const sql = buildReadOnlySqlStatement({
    query: params.query,
    relations: params.relations,
    resultLimit: params.resultLimit,
  });
  const statementTimeoutMs =
    params.statementTimeoutMs ?? DEFAULT_STATEMENT_TIMEOUT_MS;
  const client = await dbPool.connect();

  try {
    await client.query('BEGIN READ ONLY');
    await client.query(`SET LOCAL statement_timeout = ${statementTimeoutMs}`);
    await client.query(
      `SET LOCAL idle_in_transaction_session_timeout = ${statementTimeoutMs + 1_000}`
    );
    await client.query(`SET LOCAL lock_timeout = 1000`);
    await client.query(`SET LOCAL search_path = public`);

    const result = await client.query<Record<string, unknown>>(sql);
    await client.query('ROLLBACK');

    return {
      rows: result.rows,
      rowCount: result.rowCount ?? result.rows.length,
    };
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Ignore rollback failures after a read-only query error.
    }

    throw error;
  } finally {
    client.release();
  }
}
