ALTER TABLE "class_settings" ADD COLUMN "allow_display_routine_toggle" boolean DEFAULT false NOT NULL;-->statement-breakpoint
CREATE TYPE "public"."daily_student_task_key" AS ENUM('contact_book_copied', 'morning_cleaning', 'lunch_brushing', 'noon_cleaning');-->statement-breakpoint
CREATE TYPE "public"."today_manual_key" AS ENUM('contact_book_confirm', 'morning_cleaning', 'lunch_brushing', 'noon_cleaning');-->statement-breakpoint
CREATE TABLE "daily_student_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_date" date NOT NULL,
	"student_id" uuid NOT NULL,
	"task_key" "daily_student_task_key" NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);-->statement-breakpoint
CREATE TABLE "today_manual_completions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_date" date NOT NULL,
	"task_key" "today_manual_key" NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);-->statement-breakpoint
ALTER TABLE "daily_student_tasks" ADD CONSTRAINT "daily_student_tasks_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;-->statement-breakpoint
CREATE UNIQUE INDEX "daily_student_tasks_date_student_key_uidx" ON "daily_student_tasks" USING btree ("task_date","student_id","task_key");-->statement-breakpoint
CREATE UNIQUE INDEX "today_manual_completions_date_key_uidx" ON "today_manual_completions" USING btree ("task_date","task_key");
