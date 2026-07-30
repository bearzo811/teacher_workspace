DELETE FROM "homework_records";--> statement-breakpoint
DELETE FROM "homework";--> statement-breakpoint
CREATE TABLE "homework_books" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX "homework_books_name_uidx" ON "homework_books" USING btree ("name");--> statement-breakpoint
INSERT INTO "homework_books" ("name", "sort_order") VALUES
	('國習', 1),
	('數習', 2),
	('生字', 3),
	('英文', 4);--> statement-breakpoint
ALTER TABLE "homework" DROP COLUMN "title";--> statement-breakpoint
ALTER TABLE "homework" ADD COLUMN "book_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "homework" ADD COLUMN "page_label" text NOT NULL;--> statement-breakpoint
ALTER TABLE "homework" ADD CONSTRAINT "homework_book_id_homework_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "homework_books"("id") ON DELETE no action ON UPDATE no action;
