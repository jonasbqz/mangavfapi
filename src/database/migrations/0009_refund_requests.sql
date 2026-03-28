CREATE TABLE IF NOT EXISTS "premium_refund_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "profile_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "stripe_subscription_id" text NOT NULL,
  "stripe_customer_id" text,
  "reason" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "admin_note" text,
  "resolved_by_admin_id" text,
  "resolved_at" timestamp,
  "plan" "user_plan" NOT NULL DEFAULT 'premium',
  "cycle" "premium_cycle",
  "payment_method" text,
  "current_period_end" timestamp,
  "price_label" text,
  "product_name" text,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "premium_refund_requests_profile_idx"
  ON "premium_refund_requests" ("profile_id");

CREATE INDEX IF NOT EXISTS "premium_refund_requests_user_idx"
  ON "premium_refund_requests" ("user_id");

CREATE INDEX IF NOT EXISTS "premium_refund_requests_subscription_idx"
  ON "premium_refund_requests" ("stripe_subscription_id");

CREATE INDEX IF NOT EXISTS "premium_refund_requests_status_idx"
  ON "premium_refund_requests" ("status");

CREATE INDEX IF NOT EXISTS "premium_refund_requests_created_at_idx"
  ON "premium_refund_requests" ("created_at");

CREATE UNIQUE INDEX IF NOT EXISTS "premium_refund_requests_open_unique_idx"
  ON "premium_refund_requests" ("stripe_subscription_id")
  WHERE "status" IN ('pending', 'reviewing');
