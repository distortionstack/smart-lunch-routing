import type { RowDataPacket } from 'mysql2/promise';
import { closePool, getPool } from '../src/database/mysql.connection';

async function main(): Promise<void> {
  const pool = getPool();
  const [tables] = await getPool().query<RowDataPacket[]>(
    `SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='deliveries'`,
  );
  if (!tables.length) { console.log('Legacy deliveries table already absent'); return; }
  const [rows] = await pool.query<(RowDataPacket & { count: number })[]>('SELECT COUNT(*) AS count FROM deliveries');
  if (Number(rows[0]?.count ?? 0) !== 0) {
    throw new Error(`Refusing to drop deliveries: it contains ${rows[0]?.count} rows`);
  }

  const [foreignKeys] = await pool.query<(RowDataPacket & {
    table_name: string; constraint_name: string;
  })[]>(
    `SELECT DISTINCT table_name, constraint_name
     FROM information_schema.key_column_usage
     WHERE constraint_schema=DATABASE() AND referenced_table_name IS NOT NULL
       AND (table_name='deliveries' OR referenced_table_name='deliveries')`,
  );
  for (const key of foreignKeys) {
    if (!/^[A-Za-z0-9_]+$/.test(key.table_name) || !/^[A-Za-z0-9_]+$/.test(key.constraint_name)) {
      throw new Error('Refusing to drop deliveries: unexpected foreign key metadata');
    }
    await pool.query(`ALTER TABLE \`${key.table_name}\` DROP FOREIGN KEY \`${key.constraint_name}\``);
    console.log(`Removed foreign key ${key.table_name}.${key.constraint_name}`);
  }

  await pool.query('DROP TABLE deliveries');
  console.log('Removed empty legacy deliveries table');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => closePool());
