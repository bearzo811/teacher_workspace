CREATE TABLE "terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"school_year" text NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "terms_school_year_name_uidx" ON "terms" USING btree ("school_year","name");
--> statement-breakpoint
ALTER TABLE "class_settings" ADD COLUMN "active_term_id" uuid;
--> statement-breakpoint
ALTER TABLE "class_settings" ADD CONSTRAINT "class_settings_active_term_id_terms_id_fk" FOREIGN KEY ("active_term_id") REFERENCES "public"."terms"("id") ON DELETE no action ON UPDATE no action;
