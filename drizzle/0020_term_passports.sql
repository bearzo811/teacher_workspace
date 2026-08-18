CREATE TABLE "term_passport_records" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "term_id" uuid NOT NULL REFERENCES "terms"("id"),
  "student_id" uuid NOT NULL REFERENCES "students"("id"),
  "type" "passport_type" NOT NULL,
  "completed" boolean DEFAULT false NOT NULL,
  "completed_at" timestamp with time zone,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "term_passport_records_term_student_type_uidx" UNIQUE("term_id", "student_id", "type")
);
--> statement-breakpoint
CREATE TABLE "term_passport_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "passport_record_id" uuid NOT NULL REFERENCES "term_passport_records"("id"),
  "previous_completed" boolean,
  "next_completed" boolean NOT NULL,
  "actor" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
