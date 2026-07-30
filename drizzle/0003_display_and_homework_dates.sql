ALTER TABLE "homework" ADD COLUMN "contact_book_date" date;-->statement-breakpoint
UPDATE "homework" SET "contact_book_date" = "date" WHERE "contact_book_date" IS NULL;-->statement-breakpoint
ALTER TABLE "class_settings" ADD COLUMN "allow_display_homework_toggle" boolean DEFAULT false NOT NULL;-->statement-breakpoint
ALTER TABLE "class_settings" ADD COLUMN "allow_display_passport_toggle" boolean DEFAULT false NOT NULL;-->statement-breakpoint
ALTER TABLE "class_settings" ADD COLUMN "display_carousel_enabled" boolean DEFAULT false NOT NULL;-->statement-breakpoint
ALTER TABLE "class_settings" ADD COLUMN "display_token" text DEFAULT '' NOT NULL;-->statement-breakpoint
ALTER TABLE "class_settings" ADD COLUMN "display_refresh_seconds" integer DEFAULT 20 NOT NULL;
