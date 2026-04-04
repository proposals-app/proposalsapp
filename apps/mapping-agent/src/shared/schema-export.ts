import { dbPool } from '@proposalsapp/db';

interface SchemaColumnRow {
  table_name: string;
  column_name: string;
  data_type: string;
  udt_name: string;
  is_nullable: 'YES' | 'NO';
}

interface SchemaConstraintRow {
  table_name: string;
  constraint_type: 'PRIMARY KEY' | 'FOREIGN KEY';
  column_name: string | null;
  foreign_table_name: string | null;
  foreign_column_name: string | null;
}

const schemaExportCache = new Map<string, Promise<string>>();

function formatColumnType(column: SchemaColumnRow): string {
  if (column.data_type === 'USER-DEFINED') {
    return column.udt_name;
  }

  return column.data_type;
}

function renderSchemaExport(params: {
  tableNames: string[];
  columns: SchemaColumnRow[];
  constraints: SchemaConstraintRow[];
}): string {
  const columnsByTable = new Map<string, SchemaColumnRow[]>();
  for (const column of params.columns) {
    const existing = columnsByTable.get(column.table_name) ?? [];
    existing.push(column);
    columnsByTable.set(column.table_name, existing);
  }

  const constraintsByTable = new Map<string, SchemaConstraintRow[]>();
  for (const constraint of params.constraints) {
    const existing = constraintsByTable.get(constraint.table_name) ?? [];
    existing.push(constraint);
    constraintsByTable.set(constraint.table_name, existing);
  }

  const lines: string[] = [];
  for (const tableName of params.tableNames) {
    lines.push(`table public.${tableName}`);

    for (const column of columnsByTable.get(tableName) ?? []) {
      const type = formatColumnType(column);
      const nullable = column.is_nullable === 'NO' ? 'not null' : 'nullable';
      lines.push(`- ${column.column_name}: ${type} ${nullable}`);
    }

    for (const constraint of constraintsByTable.get(tableName) ?? []) {
      if (
        constraint.constraint_type === 'PRIMARY KEY' &&
        constraint.column_name
      ) {
        lines.push(`- primary key: ${constraint.column_name}`);
      }

      if (
        constraint.constraint_type === 'FOREIGN KEY' &&
        constraint.column_name &&
        constraint.foreign_table_name &&
        constraint.foreign_column_name
      ) {
        lines.push(
          `- foreign key: ${constraint.column_name} -> public.${constraint.foreign_table_name}.${constraint.foreign_column_name}`
        );
      }
    }

    lines.push('');
  }

  return lines.join('\n').trim();
}

async function loadSchemaExport(tableNames: string[]): Promise<string> {
  const client = await dbPool.connect();

  try {
    const columnsResult = await client.query<SchemaColumnRow>(
      `
        SELECT
          table_name,
          column_name,
          data_type,
          udt_name,
          is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = ANY($1::text[])
        ORDER BY table_name, ordinal_position
      `,
      [tableNames]
    );

    const constraintsResult = await client.query<SchemaConstraintRow>(
      `
        SELECT
          tc.table_name,
          tc.constraint_type,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints tc
        LEFT JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
         AND tc.table_name = kcu.table_name
        LEFT JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name
         AND tc.table_schema = ccu.table_schema
        WHERE tc.table_schema = 'public'
          AND tc.table_name = ANY($1::text[])
          AND tc.constraint_type IN ('PRIMARY KEY', 'FOREIGN KEY')
        ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name, kcu.ordinal_position
      `,
      [tableNames]
    );

    return renderSchemaExport({
      tableNames,
      columns: columnsResult.rows,
      constraints: constraintsResult.rows,
    });
  } finally {
    client.release();
  }
}

export async function getPublicSchemaExport(
  tableNames: readonly string[]
): Promise<string> {
  const normalized = [...new Set(tableNames)].sort();
  const cacheKey = normalized.join(',');

  let cached = schemaExportCache.get(cacheKey);
  if (!cached) {
    cached = loadSchemaExport(normalized);
    schemaExportCache.set(cacheKey, cached);
  }

  return cached;
}
