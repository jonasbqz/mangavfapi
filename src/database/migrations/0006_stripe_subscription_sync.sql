ALTER TABLE "profiles"
  ADD COLUMN IF NOT EXISTS "stripe_customer_id" text,
  ADD COLUMN IF NOT EXISTS "stripe_subscription_id" text,
  ADD COLUMN IF NOT EXISTS "stripe_price_id" text,
  ADD COLUMN IF NOT EXISTS "stripe_product_id" text,
  ADD COLUMN IF NOT EXISTS "stripe_product_name" text,
  ADD COLUMN IF NOT EXISTS "stripe_price_label" text,
  ADD COLUMN IF NOT EXISTS "stripe_subscription_status" text,
  ADD COLUMN IF NOT EXISTS "stripe_cancel_at_period_end" boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS "stripe_canceled_at" timestamp,
  ADD COLUMN IF NOT EXISTS "stripe_current_period_start" timestamp,
  ADD COLUMN IF NOT EXISTS "stripe_current_period_end" timestamp,
  ADD COLUMN IF NOT EXISTS "stripe_last_synced_at" timestamp;

CREATE INDEX IF NOT EXISTS "profiles_stripe_customer_idx"
  ON "profiles" ("stripe_customer_id");

CREATE INDEX IF NOT EXISTS "profiles_stripe_subscription_idx"
  ON "profiles" ("stripe_subscription_id");
