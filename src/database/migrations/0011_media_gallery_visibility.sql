ALTER TABLE "media_assets"
ADD COLUMN IF NOT EXISTS "gallery_visible" boolean DEFAULT true NOT NULL;

CREATE INDEX IF NOT EXISTS "media_assets_profile_visible_idx"
ON "media_assets" USING btree ("profile_id", "gallery_visible");
