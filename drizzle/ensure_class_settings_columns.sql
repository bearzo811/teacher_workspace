-- 正式站 DB 若停在舊 schema，在 Supabase SQL Editor 執行此檔（可重複執行）
ALTER TABLE "class_settings" ADD COLUMN IF NOT EXISTS "allow_display_homework_toggle" boolean DEFAULT false NOT NULL;
ALTER TABLE "class_settings" ADD COLUMN IF NOT EXISTS "allow_display_passport_toggle" boolean DEFAULT false NOT NULL;
ALTER TABLE "class_settings" ADD COLUMN IF NOT EXISTS "display_carousel_enabled" boolean DEFAULT false NOT NULL;
ALTER TABLE "class_settings" ADD COLUMN IF NOT EXISTS "display_token" text DEFAULT '' NOT NULL;
ALTER TABLE "class_settings" ADD COLUMN IF NOT EXISTS "display_refresh_seconds" integer DEFAULT 20 NOT NULL;
ALTER TABLE "class_settings" ADD COLUMN IF NOT EXISTS "allow_display_routine_toggle" boolean DEFAULT false NOT NULL;
ALTER TABLE "class_settings" ADD COLUMN IF NOT EXISTS "reading_school_year" text DEFAULT '' NOT NULL;
ALTER TABLE "class_settings" ADD COLUMN IF NOT EXISTS "reading_semester" text DEFAULT 'first' NOT NULL;
ALTER TABLE "class_settings" ADD COLUMN IF NOT EXISTS "allow_display_reading_toggle" boolean DEFAULT false NOT NULL;
ALTER TABLE "class_settings" ADD COLUMN IF NOT EXISTS "display_contact_book_date" text DEFAULT '' NOT NULL;
ALTER TABLE "class_settings" ADD COLUMN IF NOT EXISTS "week_one_start_date" text DEFAULT '' NOT NULL;
ALTER TABLE "class_settings" ADD COLUMN IF NOT EXISTS "term_end_date" text DEFAULT '' NOT NULL;
