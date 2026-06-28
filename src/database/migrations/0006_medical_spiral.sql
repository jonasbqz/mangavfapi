CREATE TYPE "public"."entity_reaction_target" AS ENUM('comic', 'chapter');--> statement-breakpoint
CREATE TYPE "public"."entity_reaction_type" AS ENUM('upvote', 'funny', 'love', 'surprised', 'angry', 'sad');--> statement-breakpoint
CREATE TYPE "public"."media_asset_source" AS ENUM('uploaded', 'external');--> statement-breakpoint
CREATE TYPE "public"."media_asset_type" AS ENUM('image', 'gif', 'sticker');--> statement-breakpoint
CREATE TYPE "public"."storage_provider" AS ENUM('s3', 'r2');--> statement-breakpoint
CREATE TABLE "comic_views_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"comic_id" integer NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"date" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comment_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"comment_id" uuid NOT NULL,
	"media_asset_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "comment_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"comment_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"value" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "entity_reactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" "entity_reaction_target" NOT NULL,
	"entity_id" integer NOT NULL,
	"profile_id" uuid NOT NULL,
	"reaction_type" "entity_reaction_type" NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"gallery_visible" boolean DEFAULT true NOT NULL,
	"source_type" "media_asset_source" NOT NULL,
	"media_type" "media_asset_type" NOT NULL,
	"storage_provider" "storage_provider",
	"storage_key" text,
	"original_url" text,
	"mime_type" varchar(150),
	"width" integer,
	"height" integer,
	"size_bytes" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "premium_refund_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"stripe_subscription_id" text NOT NULL,
	"stripe_customer_id" text,
	"reason" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"admin_note" text,
	"resolved_by_admin_id" text,
	"resolved_at" timestamp,
	"plan" "user_plan" DEFAULT 'premium' NOT NULL,
	"cycle" "premium_cycle",
	"payment_method" text,
	"current_period_end" timestamp,
	"price_label" text,
	"product_name" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "traffic_events" (
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
--> statement-breakpoint
ALTER TABLE "chapters" ADD COLUMN "reactions_total" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "chapters" ADD COLUMN "reactions_summary" jsonb DEFAULT '{"upvote":0,"funny":0,"love":0,"surprised":0,"angry":0,"sad":0}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "comics" ADD COLUMN "reactions_total" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "comics" ADD COLUMN "reactions_summary" jsonb DEFAULT '{"upvote":0,"funny":0,"love":0,"surprised":0,"angry":0,"sad":0}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "comics" ADD COLUMN "protected_route_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "upvotes_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "downvotes_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "score" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "premium_source" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "stripe_subscription_id" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "stripe_price_id" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "stripe_product_id" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "stripe_product_name" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "stripe_price_label" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "stripe_subscription_status" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "stripe_cancel_at_period_end" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "stripe_canceled_at" timestamp;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "stripe_current_period_start" timestamp;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "stripe_current_period_end" timestamp;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "stripe_last_synced_at" timestamp;--> statement-breakpoint
ALTER TABLE "comic_views_history" ADD CONSTRAINT "comic_views_history_comic_id_comics_id_fk" FOREIGN KEY ("comic_id") REFERENCES "public"."comics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_attachments" ADD CONSTRAINT "comment_attachments_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_attachments" ADD CONSTRAINT "comment_attachments_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_votes" ADD CONSTRAINT "comment_votes_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_votes" ADD CONSTRAINT "comment_votes_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_reactions" ADD CONSTRAINT "entity_reactions_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "premium_refund_requests" ADD CONSTRAINT "premium_refund_requests_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "premium_refund_requests" ADD CONSTRAINT "premium_refund_requests_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "comic_views_history_comic_date_idx" ON "comic_views_history" USING btree ("comic_id","date");--> statement-breakpoint
CREATE INDEX "comic_views_history_date_idx" ON "comic_views_history" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "comment_attachments_comment_media_idx" ON "comment_attachments" USING btree ("comment_id","media_asset_id");--> statement-breakpoint
CREATE INDEX "comment_attachments_comment_idx" ON "comment_attachments" USING btree ("comment_id");--> statement-breakpoint
CREATE INDEX "comment_attachments_media_idx" ON "comment_attachments" USING btree ("media_asset_id");--> statement-breakpoint
CREATE UNIQUE INDEX "comment_votes_comment_profile_idx" ON "comment_votes" USING btree ("comment_id","profile_id");--> statement-breakpoint
CREATE INDEX "comment_votes_profile_idx" ON "comment_votes" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "comment_votes_comment_idx" ON "comment_votes" USING btree ("comment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "entity_reactions_entity_profile_idx" ON "entity_reactions" USING btree ("entity_type","entity_id","profile_id");--> statement-breakpoint
CREATE INDEX "entity_reactions_entity_idx" ON "entity_reactions" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "entity_reactions_profile_idx" ON "entity_reactions" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "media_assets_profile_idx" ON "media_assets" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "media_assets_profile_visible_idx" ON "media_assets" USING btree ("profile_id","gallery_visible");--> statement-breakpoint
CREATE INDEX "media_assets_source_idx" ON "media_assets" USING btree ("source_type");--> statement-breakpoint
CREATE UNIQUE INDEX "media_assets_storage_key_idx" ON "media_assets" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "premium_refund_requests_profile_idx" ON "premium_refund_requests" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "premium_refund_requests_user_idx" ON "premium_refund_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "premium_refund_requests_subscription_idx" ON "premium_refund_requests" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE INDEX "premium_refund_requests_status_idx" ON "premium_refund_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "premium_refund_requests_created_at_idx" ON "premium_refund_requests" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "traffic_events_occurred_at_idx" ON "traffic_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "traffic_events_subject_occurred_idx" ON "traffic_events" USING btree ("subject_key","occurred_at");--> statement-breakpoint
CREATE INDEX "traffic_events_client_ip_occurred_idx" ON "traffic_events" USING btree ("client_ip","occurred_at");--> statement-breakpoint
CREATE INDEX "traffic_events_client_asn_occurred_idx" ON "traffic_events" USING btree ("client_asn","occurred_at");--> statement-breakpoint
CREATE INDEX "traffic_events_event_type_occurred_idx" ON "traffic_events" USING btree ("event_type","occurred_at");--> statement-breakpoint
CREATE INDEX "traffic_events_risk_score_occurred_idx" ON "traffic_events" USING btree ("risk_score","occurred_at");--> statement-breakpoint
CREATE INDEX "comments_chapter_score_idx" ON "comments" USING btree ("chapter_id","parent_id","score");--> statement-breakpoint
CREATE INDEX "comments_comic_score_idx" ON "comments" USING btree ("comic_id","parent_id","score");--> statement-breakpoint
CREATE INDEX "profiles_stripe_customer_idx" ON "profiles" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX "profiles_stripe_subscription_idx" ON "profiles" USING btree ("stripe_subscription_id");