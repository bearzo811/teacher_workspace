ALTER TABLE "homework"
  ADD COLUMN IF NOT EXISTS "blocks_recess" boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "blocks_shop" boolean NOT NULL DEFAULT true;
