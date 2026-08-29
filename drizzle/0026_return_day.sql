ALTER TYPE "public"."daily_student_task_key" ADD VALUE IF NOT EXISTS 'summer_homework_submitted';-->statement-breakpoint
ALTER TABLE "calendar_day_overrides" ADD COLUMN IF NOT EXISTS "is_return_day" boolean DEFAULT false NOT NULL;
