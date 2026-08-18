CREATE TABLE "daily_absences" (
  "task_date" date NOT NULL,
  "student_id" uuid NOT NULL REFERENCES "students"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "daily_absences_task_date_student_id_pk" PRIMARY KEY("task_date", "student_id")
);
