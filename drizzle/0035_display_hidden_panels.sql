ALTER TABLE "class_settings" ADD COLUMN IF NOT EXISTS "display_hidden_panels" jsonb DEFAULT '[]'::jsonb NOT NULL;
