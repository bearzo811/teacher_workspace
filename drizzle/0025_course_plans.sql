CREATE TYPE "public"."course_plan_subject" AS ENUM('chinese', 'math');
--> statement-breakpoint
CREATE TABLE "course_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"term_id" uuid NOT NULL,
	"date" date NOT NULL,
	"subject" "course_plan_subject" NOT NULL,
	"unit" text DEFAULT '' NOT NULL,
	"planned_content" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_plan_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_plan_id" uuid NOT NULL,
	"book_id" uuid NOT NULL,
	"page_label" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"published_homework_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "course_plans" ADD CONSTRAINT "course_plans_term_id_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."terms"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "course_plan_assignments" ADD CONSTRAINT "course_plan_assignments_course_plan_id_course_plans_id_fk" FOREIGN KEY ("course_plan_id") REFERENCES "public"."course_plans"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "course_plan_assignments" ADD CONSTRAINT "course_plan_assignments_book_id_homework_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."homework_books"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "course_plan_assignments" ADD CONSTRAINT "course_plan_assignments_published_homework_id_homework_id_fk" FOREIGN KEY ("published_homework_id") REFERENCES "public"."homework"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "course_plans_term_date_subject_uidx" ON "course_plans" USING btree ("term_id","date","subject");
--> statement-breakpoint
CREATE INDEX "course_plans_date_subject_idx" ON "course_plans" USING btree ("date","subject");
--> statement-breakpoint
CREATE INDEX "course_plan_assignments_plan_idx" ON "course_plan_assignments" USING btree ("course_plan_id","sort_order");
--> statement-breakpoint
CREATE UNIQUE INDEX "course_plan_assignments_plan_book_page_uidx" ON "course_plan_assignments" USING btree ("course_plan_id","book_id","page_label");
