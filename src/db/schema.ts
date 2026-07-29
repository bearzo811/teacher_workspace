import {
  boolean,
  date,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const passportTypeEnum = pgEnum("passport_type", ["Chinese", "English"]);

/** 護照格子三態 */
export const passportStatusEnum = pgEnum("passport_status", [
  "not_started",
  "missing_parent",
  "completed",
]);

export const dailyTaskKeyEnum = pgEnum("daily_task_key", [
  "chinese_passport",
  "english_passport",
  "homework",
]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
};

export const students = pgTable("students", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  seatNumber: integer("seat_number").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const passportRecords = pgTable(
  "passport_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id),
    type: passportTypeEnum("type").notNull(),
    week: integer("week").notNull(),
    status: passportStatusEnum("status").notNull().default("not_started"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("passport_records_student_type_week_uidx").on(
      table.studentId,
      table.type,
      table.week,
    ),
  ],
);

export const homework = pgTable("homework", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  date: date("date").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const homeworkRecords = pgTable(
  "homework_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    homeworkId: uuid("homework_id")
      .notNull()
      .references(() => homework.id),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id),
    completed: boolean("completed").notNull().default(false),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("homework_records_homework_student_uidx").on(
      table.homeworkId,
      table.studentId,
    ),
  ],
);

export const classSettings = pgTable("class_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  schoolYear: text("school_year").notNull(),
  grade: integer("grade").notNull(),
  className: text("class_name").notNull(),
  currentWeek: integer("current_week").notNull(),
  chineseStartWeek: integer("chinese_start_week").notNull().default(3),
  chineseEndWeek: integer("chinese_end_week").notNull().default(17),
  englishStartWeek: integer("english_start_week").notNull().default(3),
  englishEndWeek: integer("english_end_week").notNull().default(17),
  ...timestamps,
});

export const dailyTaskCompletions = pgTable(
  "daily_task_completions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    taskDate: date("task_date").notNull(),
    taskKey: dailyTaskKeyEnum("task_key").notNull(),
    completed: boolean("completed").notNull().default(false),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("daily_task_completions_date_key_uidx").on(
      table.taskDate,
      table.taskKey,
    ),
  ],
);

/** 聯絡簿當日叮嚀（作業項目同步寫入 homework） */
export const contactBookDays = pgTable(
  "contact_book_days",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    date: date("date").notNull(),
    note: text("note").notNull().default(""),
    ...timestamps,
  },
  (table) => [uniqueIndex("contact_book_days_date_uidx").on(table.date)],
);

export type Student = typeof students.$inferSelect;
export type NewStudent = typeof students.$inferInsert;
export type PassportRecord = typeof passportRecords.$inferSelect;
export type Homework = typeof homework.$inferSelect;
export type HomeworkRecord = typeof homeworkRecords.$inferSelect;
export type ClassSettings = typeof classSettings.$inferSelect;
export type DailyTaskCompletion = typeof dailyTaskCompletions.$inferSelect;
export type ContactBookDay = typeof contactBookDays.$inferSelect;
