CREATE TYPE "public"."daily_task_key" AS ENUM('chinese_passport', 'english_passport', 'homework');--> statement-breakpoint
CREATE TYPE "public"."passport_type" AS ENUM('Chinese', 'English');--> statement-breakpoint
CREATE TABLE "class_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_year" text NOT NULL,
	"grade" integer NOT NULL,
	"class_name" text NOT NULL,
	"current_week" integer NOT NULL,
	"chinese_start_week" integer DEFAULT 3 NOT NULL,
	"chinese_end_week" integer DEFAULT 17 NOT NULL,
	"english_start_week" integer DEFAULT 3 NOT NULL,
	"english_end_week" integer DEFAULT 17 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_task_completions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_date" date NOT NULL,
	"task_key" "daily_task_key" NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "homework" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "homework_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"homework_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "passport_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"type" "passport_type" NOT NULL,
	"week" integer NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"seat_number" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "homework_records" ADD CONSTRAINT "homework_records_homework_id_homework_id_fk" FOREIGN KEY ("homework_id") REFERENCES "public"."homework"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homework_records" ADD CONSTRAINT "homework_records_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passport_records" ADD CONSTRAINT "passport_records_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "daily_task_completions_date_key_uidx" ON "daily_task_completions" USING btree ("task_date","task_key");--> statement-breakpoint
CREATE UNIQUE INDEX "homework_records_homework_student_uidx" ON "homework_records" USING btree ("homework_id","student_id");--> statement-breakpoint
CREATE UNIQUE INDEX "passport_records_student_type_week_uidx" ON "passport_records" USING btree ("student_id","type","week");