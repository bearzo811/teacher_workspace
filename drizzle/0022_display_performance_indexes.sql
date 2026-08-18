CREATE INDEX IF NOT EXISTS "homework_date_idx" ON "homework" USING btree ("date");
CREATE INDEX IF NOT EXISTS "homework_contact_book_date_idx" ON "homework" USING btree ("contact_book_date");
CREATE INDEX IF NOT EXISTS "calendar_events_date_idx" ON "calendar_events" USING btree ("date");
CREATE INDEX IF NOT EXISTS "passport_records_type_week_student_idx" ON "passport_records" USING btree ("type", "week", "student_id");
CREATE INDEX IF NOT EXISTS "reading_records_type_term_student_idx" ON "reading_records" USING btree ("type", "school_year", "semester", "student_id");
