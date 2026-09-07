ALTER TABLE "shop_items"
  ADD COLUMN IF NOT EXISTS "min_level" integer NOT NULL DEFAULT 1;
