CREATE TABLE IF NOT EXISTS "student_debt_orders" (
  "student_id" uuid PRIMARY KEY REFERENCES "students"("id"),
  "item_keys" text NOT NULL DEFAULT '[]'
);
