CREATE TABLE "term_roster_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"term_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"seat_number" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "term_roster_entries" ADD CONSTRAINT "term_roster_entries_term_id_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."terms"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "term_roster_entries" ADD CONSTRAINT "term_roster_entries_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "term_roster_entries_term_student_uidx" ON "term_roster_entries" USING btree ("term_id","student_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "term_roster_entries_term_seat_uidx" ON "term_roster_entries" USING btree ("term_id","seat_number");
