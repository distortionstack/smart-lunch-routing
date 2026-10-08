import type { RowDataPacket } from 'mysql2/promise';
import { closePool, getPool } from '../src/database/mysql.connection';

const obsoleteColumns = {
  admin_users: ['last_login_at'],
  orders: ['assigned_at', 'delivered_at', 'cancelled_at'],
  delivery_job_orders: ['arrived_at'],
} as const;

async function migrate(): Promise<void> {
  const pool = getPool();
  const pending: { table: string; column: string }[] = [];

  for (const [table, columns] of Object.entries(obsoleteColumns)) {
    for (const column of columns) {
      const [exists] = await pool.execute<RowDataPacket[]>(
        `SELECT 1 FROM information_schema.columns
         WHERE table_schema=DATABASE() AND table_name=? AND column_name=? LIMIT 1`,
        [table, column],
      );
      if (!exists.length) continue;

      const [counts] = await pool.query<(RowDataPacket & { total: number; populated: number })[]>(
        `SELECT COUNT(*) AS total, COALESCE(SUM(\`${column}\` IS NOT NULL), 0) AS populated
         FROM \`${table}\``,
      );
      if (Number(counts[0]?.populated ?? 0) > 0) {
        throw new Error(`Refusing to drop ${table}.${column}: it contains non-NULL values`);
      }
      pending.push({ table, column });
    }
  }

  for (const { table, column } of pending) {
    await pool.query(`ALTER TABLE \`${table}\` DROP COLUMN \`${column}\``);
    console.log(`Removed ${table}.${column}`);
  }
  if (!pending.length) console.log('Unused NULL columns are already absent');
}

migrate()
  .catch(error => { console.error(error.message); process.exitCode = 1; })
  .finally(() => closePool());
