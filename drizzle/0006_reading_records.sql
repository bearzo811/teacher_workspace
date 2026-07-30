ALTER TABLE "class_settings" ADD COLUMN "reading_school_year" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "class_settings" ADD COLUMN "reading_semester" text DEFAULT 'first' NOT NULL;--> statement-breakpoint
ALTER TABLE "class_settings" ADD COLUMN "allow_display_reading_toggle" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE TYPE "public"."reading_type" AS ENUM('newspaper', 'reflection');--> statement-breakpoint
CREATE TABLE "reading_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"type" "reading_type" NOT NULL,
	"school_year" text NOT NULL,
	"semester" text NOT NULL,
	"month" integer NOT NULL,
	"status" "passport_status" DEFAULT 'not_started' NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "reading_records" ADD CONSTRAINT "reading_records_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reading_records_student_type_term_month_uidx" ON "reading_records" USING btree ("student_id","type","school_year","semester","month");
