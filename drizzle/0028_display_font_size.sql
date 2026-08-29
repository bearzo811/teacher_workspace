ALTER TABLE "class_settings"
ADD COLUMN IF NOT EXISTS "display_font_size" integer DEFAULT 16 NOT NULL;
