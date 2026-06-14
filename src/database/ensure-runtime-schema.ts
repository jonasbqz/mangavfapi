import type { Pool } from 'pg';

const RUNTIME_SCHEMA_SQL = `
ALTER TABLE "comics"
  ADD COLUMN IF NOT EXISTS "protected_route_enabled" boolean DEFAULT false;

UPDATE "comics"
SET "protected_route_enabled" = false
WHERE "protected_route_enabled" IS NULL;

ALTER TABLE "comics"
  ADD COLUMN IF NOT EXISTS "reactions_total" integer DEFAULT 0;

UPDATE "comics"
SET "reactions_total" = 0
WHERE "reactions_total" IS NULL;

ALTER TABLE "comics"
  ADD COLUMN IF NOT EXISTS "reactions_summary" jsonb DEFAULT '{"upvote":0,"funny":0,"love":0,"surprised":0,"angry":0,"sad":0}'::jsonb;

UPDATE "comics"
SET "reactions_summary" = '{"upvote":0,"funny":0,"love":0,"surprised":0,"angry":0,"sad":0}'::jsonb
WHERE "reactions_summary" IS NULL;

ALTER TABLE "chapters"
  ADD COLUMN IF NOT EXISTS "reactions_total" integer DEFAULT 0;

UPDATE "chapters"
SET "reactions_total" = 0
WHERE "reactions_total" IS NULL;

ALTER TABLE "chapters"
  ADD COLUMN IF NOT EXISTS "reactions_summary" jsonb DEFAULT '{"upvote":0,"funny":0,"love":0,"surprised":0,"angry":0,"sad":0}'::jsonb;

UPDATE "chapters"
SET "reactions_summary" = '{"upvote":0,"funny":0,"love":0,"surprised":0,"angry":0,"sad":0}'::jsonb
WHERE "reactions_summary" IS NULL;

ALTER TABLE "comics"
  ADD COLUMN IF NOT EXISTS "is_hentai" boolean DEFAULT false;

UPDATE "comics"
SET "is_hentai" = false
WHERE "is_hentai" IS NULL;

ALTER TABLE "comics"
  ADD COLUMN IF NOT EXISTS "search_vector" tsvector;

CREATE INDEX IF NOT EXISTS "comics_is_hentai_idx" ON "comics" USING btree ("is_hentai");
CREATE INDEX IF NOT EXISTS "comics_search_vector_idx" ON "comics" USING gin ("search_vector");
`;

const REQUIRED_COLUMNS: Array<{ table: string; column: string }> = [
  { table: 'comics', column: 'reactions_total' },
  { table: 'comics', column: 'reactions_summary' },
  { table: 'comics', column: 'protected_route_enabled' },
  { table: 'comics', column: 'is_hentai' },
  { table: 'comics', column: 'search_vector' },
  { table: 'chapters', column: 'reactions_total' },
  { table: 'chapters', column: 'reactions_summary' },
];

async function verifyRequiredColumns(pool: Pool): Promise<string[]> {
  const result = await pool.query<{ table_name: string; column_name: string }>(
    `
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (table_name, column_name) IN (
          SELECT *
          FROM unnest($1::text[], $2::text[])
        )
    `,
    [
      REQUIRED_COLUMNS.map((item) => item.table),
      REQUIRED_COLUMNS.map((item) => item.column),
    ],
  );

  const present = new Set(
    result.rows.map((row) => `${row.table_name}.${row.column_name}`),
  );

  return REQUIRED_COLUMNS
    .filter((item) => !present.has(`${item.table}.${item.column}`))
    .map((item) => `${item.table}.${item.column}`);
}

export async function ensureRuntimeSchema(pool: Pool): Promise<void> {
  const missingBefore = await verifyRequiredColumns(pool);
  if (missingBefore.length === 0) {
    return;
  }

  console.warn(
    `[db] missing runtime columns: ${missingBefore.join(', ')} — applying repair SQL`,
  );

  await pool.query(RUNTIME_SCHEMA_SQL);

  const missingAfter = await verifyRequiredColumns(pool);
  if (missingAfter.length > 0) {
    throw new Error(
      `Database schema repair incomplete. Still missing: ${missingAfter.join(', ')}`,
    );
  }

  console.log('[db] runtime schema repair completed');
}
