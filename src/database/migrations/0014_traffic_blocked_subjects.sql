CREATE TABLE IF NOT EXISTS "traffic_blocked_subjects" (
  "subject_key" text PRIMARY KEY,
  "client_ip" varchar(64),
  "client_asn" integer,
  "user_agent" text,
  "status" text DEFAULT 'active' NOT NULL,
  "block_reason" text,
  "reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "risk_score" integer DEFAULT 0 NOT NULL,
  "first_blocked_at" timestamp DEFAULT now() NOT NULL,
  "last_blocked_at" timestamp DEFAULT now() NOT NULL,
  "blocked_count" integer DEFAULT 1 NOT NULL,
  "unblocked_at" timestamp,
  "unblocked_by" text,
  "unblock_reason" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS "traffic_blocked_subjects_status_idx"
  ON "traffic_blocked_subjects" ("status", "last_blocked_at");
CREATE INDEX IF NOT EXISTS "traffic_blocked_subjects_ip_idx"
  ON "traffic_blocked_subjects" ("client_ip");
CREATE INDEX IF NOT EXISTS "traffic_blocked_subjects_asn_idx"
  ON "traffic_blocked_subjects" ("client_asn");
