ALTER TABLE "class_settings" ADD COLUMN IF NOT EXISTS "display_token_hash" text DEFAULT '' NOT NULL;
