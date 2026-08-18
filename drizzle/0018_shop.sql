CREATE TYPE "public"."shop_order_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled');
--> statement-breakpoint
ALTER TABLE "class_settings" ADD COLUMN "shop_open" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
CREATE TABLE "shop_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "icon" text NOT NULL DEFAULT '🎁',
  "price" integer NOT NULL,
  "stock" integer NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop_orders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "item_id" uuid NOT NULL REFERENCES "shop_items"("id"),
  "student_id" uuid NOT NULL REFERENCES "students"("id"),
  "price" integer NOT NULL,
  "status" "shop_order_status" DEFAULT 'pending' NOT NULL,
  "requested_at" timestamp with time zone DEFAULT now() NOT NULL,
  "resolved_at" timestamp with time zone,
  "resolved_by" text
);
--> statement-breakpoint
CREATE INDEX "shop_orders_status_idx" ON "shop_orders" USING btree ("status", "requested_at");
