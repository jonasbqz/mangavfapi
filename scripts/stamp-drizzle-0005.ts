import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';

const MIGRATION_FILE = '0005_gorgeous_vivisector.sql';
const MIGRATION_CREATED_AT = '1774092040341';

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const sqlPath = join(
    process.cwd(),
    'src/database/migrations',
    MIGRATION_FILE,
  );
  const sql = readFileSync(sqlPath, 'utf8');
  const hash = createHash('sha256').update(sql).digest('hex');

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'drizzle' AND table_name = '__drizzle_migrations'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('[stamp] Table drizzle.__drizzle_migrations does not exist. Skipping stamp as drizzle-kit migrate will handle it.');
      return;
    }

    const existing = await pool.query(
      'SELECT id FROM drizzle.__drizzle_migrations WHERE created_at = $1 OR hash = $2',
      [MIGRATION_CREATED_AT, hash],
    );

    if (existing.rows.length > 0) {
      console.log('[stamp] drizzle 0005 already recorded');
      return;
    }

    await pool.query(
      'INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)',
      [hash, MIGRATION_CREATED_AT],
    );

    console.log('[stamp] recorded drizzle migration 0005_gorgeous_vivisector');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('[stamp] failed:', error);
  process.exit(1);
});
