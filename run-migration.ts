import { readFileSync } from 'fs';
import { config } from 'dotenv';
import { Pool } from 'pg';

config();

const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error('Usage: npx tsx run-migration.ts <path-to-sql-file>');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
});

async function run() {
  const sqlContent = readFileSync(migrationFile, 'utf-8');
  const client = await pool.connect();

  try {
    console.log(`Connected to database`);
    console.log(`Running migration: ${migrationFile}`);
    await client.query(sqlContent);
    console.log('Migration completed successfully!');
  } catch (err: any) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
