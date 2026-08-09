CREATE TYPE "public"."game_currency" AS ENUM('xp', 'coins');--> statement-breakpoint
CREATE TABLE "gamification_settings" (
  "id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
  "enabled_at" timestamp with time zone DEFAULT now() NOT NULL,
  "homework_on_time_coins" integer DEFAULT 2 NOT NULL,
  "homework_late_coins" integer DEFAULT 1 NOT NULL,
  "homework_missed_coins" integer DEFAULT -1 NOT NULL,
  "passport_on_time_coins" integer DEFAULT 5 NOT NULL,
  "passport_late_coins" integer DEFAULT 2 NOT NULL,
  "passport_missed_coins" integer DEFAULT -2 NOT NULL,
  "routine_xp" integer DEFAULT 2 NOT NULL,
  "level_base_xp" integer DEFAULT 100 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "student_game_profiles" (
  "student_id" uuid PRIMARY KEY NOT NULL,
  "xp_total" integer DEFAULT 0 NOT NULL,
  "coin_net" integer DEFAULT 0 NOT NULL,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "gamification_effects" (
  "effect_key" text PRIMARY KEY NOT NULL,
  "student_id" uuid NOT NULL,
  "currency" "game_currency" NOT NULL,
  "source_type" text NOT NULL,
  "source_id" text NOT NULL,
  "effect_type" text NOT NULL,
  "amount" integer DEFAULT 0 NOT NULL,
  "rule_snapshot" text DEFAULT '{}' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "gamification_ledger" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "student_id" uuid NOT NULL,
  "effect_key" text NOT NULL,
  "currency" "game_currency" NOT NULL,
  "delta" integer NOT NULL,
  "balance_after" integer NOT NULL,
  "reason" text NOT NULL,
  "metadata" text DEFAULT '{}' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "student_game_profiles" ADD CONSTRAINT "student_game_profiles_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gamification_effects" ADD CONSTRAINT "gamification_effects_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gamification_ledger" ADD CONSTRAINT "gamification_ledger_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gamification_effects_student_idx" ON "gamification_effects" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "gamification_effects_source_idx" ON "gamification_effects" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "gamification_ledger_student_created_idx" ON "gamification_ledger" USING btree ("student_id","created_at");--> statement-breakpoint
INSERT INTO "gamification_settings" ("id") VALUES ('default') ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
INSERT INTO "student_game_profiles" ("student_id", "started_at")
SELECT "id", now() FROM "students"
ON CONFLICT ("student_id") DO NOTHING;
