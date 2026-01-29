-- Performance indexes for common queries

-- chapters: ordering by created_at (recent chapters)
CREATE INDEX IF NOT EXISTS "chapters_created_at_idx" ON "chapters" USING btree ("created_at" DESC);

-- chapters: composite for recent by comic_scan
CREATE INDEX IF NOT EXISTS "chapters_comic_scan_created_idx" ON "chapters" USING btree ("comic_scan_id", "created_at" DESC);

-- comics: views for popular sorting
CREATE INDEX IF NOT EXISTS "comics_views_idx" ON "comics" USING btree ("views" DESC);

-- comics: updated_at for recent sorting
CREATE INDEX IF NOT EXISTS "comics_updated_at_idx" ON "comics" USING btree ("updated_at" DESC);

-- comics: created_at for new comics
CREATE INDEX IF NOT EXISTS "comics_created_at_idx" ON "comics" USING btree ("created_at" DESC);

-- comics: type filter
CREATE INDEX IF NOT EXISTS "comics_type_idx" ON "comics" USING btree ("type");

-- comics: is_nsfw filter
CREATE INDEX IF NOT EXISTS "comics_is_nsfw_idx" ON "comics" USING btree ("is_nsfw");

-- comic_scans: external_id for scraper lookups
CREATE INDEX IF NOT EXISTS "comic_scans_external_id_idx" ON "comic_scans" USING btree ("external_id");

-- comic_scans: scan_group_id for filtering
CREATE INDEX IF NOT EXISTS "comic_scans_scan_group_idx" ON "comic_scans" USING btree ("scan_group_id");

-- comic_genres: genre_id for filtering by genre
CREATE INDEX IF NOT EXISTS "comic_genres_genre_idx" ON "comic_genres" USING btree ("genre_id");

-- genres: name for search
CREATE INDEX IF NOT EXISTS "genres_name_idx" ON "genres" USING btree ("name");
