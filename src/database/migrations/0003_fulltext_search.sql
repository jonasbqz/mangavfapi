-- Full-Text Search migration for comics table
-- Run manually with psql, not with drizzle

CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE comics ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE OR REPLACE FUNCTION comics_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', unaccent(COALESCE(NEW.title, ''))), 'A') ||
    setweight(to_tsvector('simple', unaccent(COALESCE(NEW.title_alternative, ''))), 'B') ||
    setweight(to_tsvector('simple', unaccent(COALESCE(NEW.author, ''))), 'B') ||
    setweight(to_tsvector('simple', unaccent(COALESCE(NEW.artist, ''))), 'B') ||
    setweight(to_tsvector('simple', unaccent(COALESCE(NEW.description, ''))), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS comics_search_vector_trigger ON comics;
CREATE TRIGGER comics_search_vector_trigger
  BEFORE INSERT OR UPDATE OF title, title_alternative, author, artist, description ON comics
  FOR EACH ROW EXECUTE FUNCTION comics_search_vector_update();

-- Populate existing records
UPDATE comics SET search_vector =
  setweight(to_tsvector('simple', unaccent(COALESCE(title, ''))), 'A') ||
  setweight(to_tsvector('simple', unaccent(COALESCE(title_alternative, ''))), 'B') ||
  setweight(to_tsvector('simple', unaccent(COALESCE(author, ''))), 'B') ||
  setweight(to_tsvector('simple', unaccent(COALESCE(artist, ''))), 'B') ||
  setweight(to_tsvector('simple', unaccent(COALESCE(description, ''))), 'C');

CREATE INDEX IF NOT EXISTS comics_search_vector_idx ON comics USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS comics_title_trgm_idx ON comics USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS comics_title_alt_trgm_idx ON comics USING GIN (title_alternative gin_trgm_ops);
