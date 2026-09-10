ALTER TABLE "gamification_settings"
  ADD COLUMN IF NOT EXISTS "passport_monday_coins" integer NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS "passport_tuesday_coins" integer NOT NULL DEFAULT 6,
  ADD COLUMN IF NOT EXISTS "passport_wednesday_coins" integer NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS "passport_thursday_coins" integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS "passport_friday_coins" integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "passport_overdue_daily_coins" integer NOT NULL DEFAULT -1,
  ADD COLUMN IF NOT EXISTS "reading_newspaper_coins" integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS "reading_reflection_coins" integer NOT NULL DEFAULT 5;
