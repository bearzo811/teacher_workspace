ALTER TABLE "class_settings" ADD COLUMN "week_one_start_date" text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE "class_settings" SET "chinese_end_week" = 16 WHERE "chinese_end_week" = 17;--> statement-breakpoint
UPDATE "class_settings" SET "english_end_week" = 16 WHERE "english_end_week" = 17;
