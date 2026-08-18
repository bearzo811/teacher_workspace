CREATE TYPE "reward_kind" AS ENUM ('physical', 'privilege');
CREATE TYPE "reward_status" AS ENUM ('available', 'requested', 'redeemed', 'revoked');
CREATE TYPE "reward_source" AS ENUM ('purchase', 'gift');
ALTER TABLE "shop_items" ADD COLUMN "kind" "reward_kind" DEFAULT 'physical' NOT NULL;
ALTER TABLE "shop_items" ADD COLUMN "description" text DEFAULT '' NOT NULL;
CREATE TABLE "student_rewards" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "student_id" uuid NOT NULL REFERENCES "students"("id"),
  "item_id" uuid REFERENCES "shop_items"("id"),
  "item_name" text NOT NULL,
  "item_icon" text DEFAULT '🎁' NOT NULL,
  "kind" "reward_kind" NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "price_paid" integer DEFAULT 0 NOT NULL,
  "source" "reward_source" NOT NULL,
  "status" "reward_status" DEFAULT 'available' NOT NULL,
  "requested_at" timestamp with time zone,
  "redeemed_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "student_reward_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "reward_id" uuid NOT NULL REFERENCES "student_rewards"("id"),
  "action" text NOT NULL,
  "actor" text NOT NULL,
  "note" text DEFAULT '' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX "student_rewards_student_status_idx" ON "student_rewards" USING btree ("student_id", "status");
CREATE INDEX "student_rewards_status_requested_idx" ON "student_rewards" USING btree ("status", "requested_at");
CREATE INDEX "student_reward_history_reward_idx" ON "student_reward_history" USING btree ("reward_id", "created_at");
