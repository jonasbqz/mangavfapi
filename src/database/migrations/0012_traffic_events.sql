CREATE TABLE IF NOT EXISTS "traffic_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "occurred_at" timestamp DEFAULT now() NOT NULL,
  "event_type" text NOT NULL,
  "action" text DEFAULT 'allow' NOT NULL,
  "subject_key" text NOT NULL,
  "client_ip" varchar(64),
  "client_asn" integer,
  "user_agent" text,
  "path" text,
  "method" varchar(16),
  "referer" text,
  "accept_language" text,
  "user_id" text,
  "search_query" text,
  "entity_type" text,
  "entity_id" integer,
  "risk_score" integer DEFAULT 0 NOT NULL,
  "reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS "traffic_events_occurred_at_idx" ON "traffic_events" ("occurred_at");
CREATE INDEX IF NOT EXISTS "traffic_events_subject_occurred_idx" ON "traffic_events" ("subject_key", "occurred_at");
CREATE INDEX IF NOT EXISTS "traffic_events_client_ip_occurred_idx" ON "traffic_events" ("client_ip", "occurred_at");
CREATE INDEX IF NOT EXISTS "traffic_events_client_asn_occurred_idx" ON "traffic_events" ("client_asn", "occurred_at");
CREATE INDEX IF NOT EXISTS "traffic_events_event_type_occurred_idx" ON "traffic_events" ("event_type", "occurred_at");
CREATE INDEX IF NOT EXISTS "traffic_events_risk_score_occurred_idx" ON "traffic_events" ("risk_score", "occurred_at");
