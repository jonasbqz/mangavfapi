-- Safety net for environments that only ran drizzle-kit journal migrations (0000-0005).

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
