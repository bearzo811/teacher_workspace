create table if not exists "duty_substitutions" (
  "id" uuid primary key default gen_random_uuid(),
  "date" date not null,
  "slot_key" text not null,
  "absent_student_id" uuid not null references "students"("id"),
  "substitute_student_id" uuid references "students"("id"),
  "status" text not null default 'open',
  "is_volunteer" boolean not null default false,
  "confirmed_at" timestamp with time zone,
  "created_at" timestamp with time zone not null default now(),
  "updated_at" timestamp with time zone not null default now()
);
create unique index if not exists "duty_substitutions_date_slot_uidx" on "duty_substitutions" ("date", "slot_key");
create index if not exists "duty_substitutions_date_status_idx" on "duty_substitutions" ("date", "status");

create table if not exists "duty_makeups" (
  "id" uuid primary key default gen_random_uuid(),
  "student_id" uuid not null references "students"("id"),
  "source_date" date not null,
  "source_slot_key" text not null,
  "assigned_date" date,
  "assigned_slot_key" text,
  "status" text not null default 'pending',
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone not null default now(),
  "updated_at" timestamp with time zone not null default now()
);
create unique index if not exists "duty_makeups_source_uidx" on "duty_makeups" ("student_id", "source_date", "source_slot_key");
create index if not exists "duty_makeups_student_status_idx" on "duty_makeups" ("student_id", "status");
