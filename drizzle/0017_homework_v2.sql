CREATE TYPE "public"."homework_status" AS ENUM('unsubmitted', 'pending_confirmation', 'correction_required', 'completed');
--> statement-breakpoint
CREATE TABLE "homework_subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "homework_subjects_name_uidx" ON "homework_subjects" USING btree ("name");
--> statement-breakpoint
ALTER TABLE "homework_books" ADD COLUMN "subject_id" uuid;
--> statement-breakpoint
ALTER TABLE "homework_books" ADD CONSTRAINT "homework_books_subject_id_homework_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."homework_subjects"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "homework_records" ADD COLUMN "status" "homework_status" DEFAULT 'unsubmitted' NOT NULL;
--> statement-breakpoint
UPDATE "homework_records" SET "status" = CASE WHEN "completed" THEN 'completed'::"homework_status" ELSE 'unsubmitted'::"homework_status" END;
--> statement-breakpoint
CREATE TABLE "homework_record_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"homework_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"previous_status" "homework_status",
	"next_status" "homework_status" NOT NULL,
	"actor" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "homework_record_history" ADD CONSTRAINT "homework_record_history_homework_id_homework_id_fk" FOREIGN KEY ("homework_id") REFERENCES "public"."homework"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "homework_record_history" ADD CONSTRAINT "homework_record_history_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "homework_record_history_record_idx" ON "homework_record_history" USING btree ("homework_id","student_id");
