import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { config } from 'dotenv';

config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL is required to run migrations');
  process.exit(1);
}

async function run() {
  const pool = new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 10000,
  });
  const db = drizzle(pool);
  
  try {
    console.log('Running Drizzle migrations programmatically...');
    await migrate(db, { migrationsFolder: './src/database/migrations' });
    console.log('Drizzle migrations applied successfully!');
  } catch (err: any) {
    console.error('Error running Drizzle migrations:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
