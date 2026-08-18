CREATE TABLE "contact_book_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "weekday" integer NOT NULL,
  "notes" text NOT NULL DEFAULT '[]',
  "assignments" text NOT NULL DEFAULT '[]',
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "contact_book_templates_weekday_uidx" UNIQUE("weekday")
);
