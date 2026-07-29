CREATE TYPE "public"."passport_status" AS ENUM('not_started', 'missing_parent', 'completed');--> statement-breakpoint
ALTER TABLE "passport_records" ADD COLUMN "status" "passport_status" DEFAULT 'not_started' NOT NULL;--> statement-breakpoint
UPDATE "passport_records" SET "status" = 'completed' WHERE "completed" = true;--> statement-breakpoint
UPDATE "passport_records" SET "status" = 'not_started' WHERE "completed" = false;--> statement-breakpoint
ALTER TABLE "passport_records" DROP COLUMN "completed";
