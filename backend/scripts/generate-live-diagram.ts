import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { RowDataPacket } from 'mysql2/promise';
import { closePool, getPool } from '../src/database/mysql.connection';

type TableRow = RowDataPacket & {
  table_name: string; table_comment: string; table_collation: string | null;
};
type ColumnRow = RowDataPacket & {
  table_name: string; column_name: string; column_type: string;
  is_nullable: 'YES' | 'NO'; column_default: string | number | null;
  extra: string; column_comment: string; ordinal_position: number;
};
type IndexRow = RowDataPacket & {
  table_name: string; index_name: string; non_unique: number;
  column_name: string | null; seq_in_index: number;
};
type ForeignKeyRow = RowDataPacket & {
  table_name: string; constraint_name: string; column_name: string;
  referenced_table_name: string; referenced_column_name: string;
  ordinal_position: number; delete_rule: string; update_rule: string;
};
type CheckRow = RowDataPacket & {
  table_name: string; constraint_name: string; check_clause: string;
};

const escapeNote = (value: string): string => value.replaceAll('\\', '\\\\').replaceAll("'", "\\'").replaceAll('\n', ' ');
const quoteType = (value: string): string => `"${value.replaceAll('"', '\\"')}"`;
const defaultOption = (value: string | number | null): string | null => {
  if (value === null) return null;
  const text = String(value);
  if (/^(?:current_timestamp(?:\(\))?|now\(\)|uuid\(\))$/i.test(text)) return `default: \`${text}\``;
  if (/^-?\d+(?:\.\d+)?$/.test(text)) return `default: ${text}`;
  return `default: '${escapeNote(text)}'`;
};
const id = (value: string): string => /^[A-Za-z_][A-Za-z0-9_]*$/.test(value) ? value : `"${value.replaceAll('"', '\\"')}"`;

async function main(): Promise<void> {
  const pool = getPool();
  const [[db]] = await pool.query<(RowDataPacket & { schema_name: string })[]>('SELECT DATABASE() AS schema_name');
  if (!db?.schema_name) throw new Error('No selected database');
  const [tables] = await pool.query<TableRow[]>(
    `SELECT table_name, COALESCE(table_comment, '') AS table_comment, table_collation
     FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'
       AND table_name <> 'deliveries'
     ORDER BY table_name`,
  );
  const [columns] = await pool.query<ColumnRow[]>(
    `SELECT table_name, column_name, column_type, is_nullable, column_default,
            COALESCE(extra, '') AS extra, COALESCE(column_comment, '') AS column_comment,
            ordinal_position
     FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name <> 'deliveries'
     ORDER BY table_name, ordinal_position`,
  );
  const [indexes] = await pool.query<IndexRow[]>(
    `SELECT table_name, index_name, non_unique, column_name, seq_in_index
     FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name <> 'deliveries'
     ORDER BY table_name, index_name, seq_in_index`,
  );
  const [foreignKeys] = await pool.query<ForeignKeyRow[]>(
    `SELECT k.table_name, k.constraint_name, k.column_name,
            k.referenced_table_name, k.referenced_column_name, k.ordinal_position,
            r.delete_rule, r.update_rule
     FROM information_schema.key_column_usage k
     JOIN information_schema.referential_constraints r
       ON r.constraint_schema = k.constraint_schema
      AND r.constraint_name = k.constraint_name
      AND r.table_name = k.table_name
     WHERE k.table_schema = DATABASE() AND k.referenced_table_name IS NOT NULL
       AND k.table_name <> 'deliveries' AND k.referenced_table_name <> 'deliveries'
     ORDER BY k.table_name, k.constraint_name, k.ordinal_position`,
  );
  let checks: CheckRow[] = [];
  try {
    [checks] = await pool.query<CheckRow[]>(
      `SELECT tc.table_name, tc.constraint_name, cc.check_clause
       FROM information_schema.table_constraints tc
       JOIN information_schema.check_constraints cc
         ON cc.constraint_schema = tc.constraint_schema
        AND cc.constraint_name = tc.constraint_name
       WHERE tc.table_schema = DATABASE() AND tc.constraint_type = 'CHECK'
         AND tc.table_name <> 'deliveries'
       ORDER BY tc.table_name, tc.constraint_name`,
    );
  } catch (error) {
    console.warn(`CHECK metadata unavailable: ${(error as Error).message}`);
  }

  const orderedNames = [
    'admin_users', 'customers', 'riders', 'orders', 'shop_settings',
    'route_plans', 'delivery_jobs', 'delivery_job_orders',
    'auth_sessions', 'auth_login_attempts',
  ];
  tables.sort((a, b) => {
    const ai = orderedNames.indexOf(a.table_name);
    const bi = orderedNames.indexOf(b.table_name);
    return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi) || a.table_name.localeCompare(b.table_name);
  });

  const lines = [
    '// Generated from the connected TiDB database information_schema.',
    '// Read-only metadata query; no application rows were accessed.',
    '// Excludes the retired legacy deliveries table.',
    `// Database: ${db.schema_name}`,
    `// Generated at: ${new Date().toISOString()}`,
    '',
    `Project ${id(db.schema_name)} {`,
    "  database_type: 'MySQL'",
    "  Note: 'Live TiDB schema snapshot. Regenerate with npx tsx scripts/generate-live-diagram.ts.'",
    '}',
    '',
  ];

  for (const table of tables) {
    const tableChecks = checks.filter(c => c.table_name === table.table_name);
    const note = [
      table.table_comment && table.table_comment,
      table.table_collation && `Collation: ${table.table_collation}`,
      ...tableChecks.map(c => `CHECK ${c.constraint_name}: ${c.check_clause}`),
    ].filter(Boolean).join(' | ');
    lines.push(`Table ${id(table.table_name)}${note ? ` [note: '${escapeNote(note)}']` : ''} {`);
    const tableIndexes = indexes.filter(i => i.table_name === table.table_name);
    const pkColumns = tableIndexes.filter(i => i.index_name === 'PRIMARY').sort((a, b) => a.seq_in_index - b.seq_in_index);
    for (const col of columns.filter(c => c.table_name === table.table_name)) {
      const options: string[] = [];
      if (pkColumns.length === 1 && pkColumns[0]?.column_name === col.column_name) options.push('pk');
      if (col.is_nullable === 'NO') options.push('not null');
      if (/auto_increment/i.test(col.extra)) options.push('increment');
      const def = defaultOption(col.column_default);
      if (def) options.push(def);
      const extraNote = col.extra.replace(/auto_increment/ig, '').trim();
      const columnNote = [col.column_comment, extraNote].filter(Boolean).join(' | ');
      if (columnNote) options.push(`note: '${escapeNote(columnNote)}'`);
      lines.push(`  ${id(col.column_name)} ${quoteType(col.column_type)}${options.length ? ` [${options.join(', ')}]` : ''}`);
    }
    const byIndex = new Map<string, IndexRow[]>();
    for (const index of tableIndexes) {
      const list = byIndex.get(index.index_name) ?? [];
      list.push(index);
      byIndex.set(index.index_name, list);
    }
    if (byIndex.size > (pkColumns.length === 1 ? 1 : 0)) {
      lines.push('', '  indexes {');
      for (const [name, parts] of byIndex) {
        if (name === 'PRIMARY' && pkColumns.length === 1) continue;
        const indexColumns = parts.sort((a, b) => a.seq_in_index - b.seq_in_index).map(p => p.column_name);
        if (indexColumns.some(c => !c)) continue;
        const tuple = indexColumns.length === 1 ? id(indexColumns[0]!) : `(${indexColumns.map(c => id(c!)).join(', ')})`;
        const flags = [name === 'PRIMARY' ? 'pk' : Number(parts[0]?.non_unique) === 0 ? 'unique' : null, `name: '${escapeNote(name)}'`].filter(Boolean);
        lines.push(`    ${tuple} [${flags.join(', ')}]`);
      }
      lines.push('  }');
    }
    lines.push('}', '');
  }

  const byFk = new Map<string, ForeignKeyRow[]>();
  for (const fk of foreignKeys) {
    const key = `${fk.table_name}.${fk.constraint_name}`;
    const list = byFk.get(key) ?? [];
    list.push(fk);
    byFk.set(key, list);
  }
  for (const parts of byFk.values()) {
    parts.sort((a, b) => a.ordinal_position - b.ordinal_position);
    const first = parts[0]!;
    const from = parts.length === 1 ? id(first.column_name) : `(${parts.map(p => id(p.column_name)).join(', ')})`;
    const to = parts.length === 1 ? id(first.referenced_column_name) : `(${parts.map(p => id(p.referenced_column_name)).join(', ')})`;
    const actions = [
      first.delete_rule !== 'RESTRICT' && first.delete_rule !== 'NO ACTION' ? `delete: ${first.delete_rule.toLowerCase()}` : null,
      first.update_rule !== 'RESTRICT' && first.update_rule !== 'NO ACTION' ? `update: ${first.update_rule.toLowerCase()}` : null,
    ].filter(Boolean);
    lines.push(`Ref ${id(first.constraint_name)}: ${id(first.table_name)}.${from} > ${id(first.referenced_table_name)}.${to}${actions.length ? ` [${actions.join(', ')}]` : ''}`);
  }
  lines.push('');
  const target = path.resolve('database/diagram.dbml');
  await writeFile(target, lines.join('\n'), 'utf8');
  console.log(`Wrote ${target}: ${tables.length} tables, ${columns.length} columns, ${byFk.size} foreign keys, ${checks.length} checks.`);
}

main().catch(error => {
  console.error((error as Error).message);
  process.exitCode = 1;
}).finally(() => closePool());
