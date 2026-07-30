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

/** 學生當日例行／已抄（大屏個人清單） */
export const dailyStudentTaskKeyEnum = pgEnum("daily_student_task_key", [
  "contact_book_copied",
  "morning_cleaning",
  "lunch_brushing",
  "noon_cleaning",
]);

/** 老師 Today 手動確認項 */
export const todayManualKeyEnum = pgEnum("today_manual_key", [
  "contact_book_confirm",
  "morning_cleaning",
  "lunch_brushing",
  "noon_cleaning",
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
  /** 繳交日 */
  date: date("date").notNull(),
  /** 聯絡簿上寫的那一天（可與繳交日不同） */
  contactBookDate: date("contact_book_date"),
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
  /** 大屏：允許學生自助打勾作業 */
  allowDisplayHomeworkToggle: boolean("allow_display_homework_toggle")
    .notNull()
    .default(false),
  /** 大屏：允許學生自助點護照（僅本週完成） */
  allowDisplayPassportToggle: boolean("allow_display_passport_toggle")
    .notNull()
    .default(false),
  /** 大屏：允許學生自助勾每日任務／已抄聯絡簿 */
  allowDisplayRoutineToggle: boolean("allow_display_routine_toggle")
    .notNull()
    .default(false),
  /** 大屏：面板自動輪播 */
  displayCarouselEnabled: boolean("display_carousel_enabled")
    .notNull()
    .default(false),
  /** 大屏存取 token（空字串＝不驗證） */
  displayToken: text("display_token").notNull().default(""),
  /** 大屏輪詢秒數 */
  displayRefreshSeconds: integer("display_refresh_seconds").notNull().default(20),
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

/** 學生當日例行勾選（已抄／打掃／刷牙） */
export const dailyStudentTasks = pgTable(
  "daily_student_tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    taskDate: date("task_date").notNull(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id),
    taskKey: dailyStudentTaskKeyEnum("task_key").notNull(),
    completed: boolean("completed").notNull().default(false),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("daily_student_tasks_date_student_key_uidx").on(
      table.taskDate,
      table.studentId,
      table.taskKey,
    ),
  ],
);

/** 老師 Today 手動確認（打掃等；聯絡簿亦可手動收工） */
export const todayManualCompletions = pgTable(
  "today_manual_completions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    taskDate: date("task_date").notNull(),
    taskKey: todayManualKeyEnum("task_key").notNull(),
    completed: boolean("completed").notNull().default(false),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("today_manual_completions_date_key_uidx").on(
      table.taskDate,
      table.taskKey,
    ),
  ],
);

export type Student = typeof students.$inferSelect;
export type NewStudent = typeof students.$inferInsert;
export type PassportRecord = typeof passportRecords.$inferSelect;
export type Homework = typeof homework.$inferSelect;
export type HomeworkRecord = typeof homeworkRecords.$inferSelect;
export type ClassSettings = typeof classSettings.$inferSelect;
export type DailyTaskCompletion = typeof dailyTaskCompletions.$inferSelect;
export type ContactBookDay = typeof contactBookDays.$inferSelect;
export type DailyStudentTask = typeof dailyStudentTasks.$inferSelect;
export type TodayManualCompletion = typeof todayManualCompletions.$inferSelect;
