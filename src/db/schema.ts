import {
  boolean,
  date,
  index,
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

export const homeworkStatusEnum = pgEnum("homework_status", [
  "unsubmitted",
  "pending_confirmation",
  "correction_required",
  "completed",
]);
export const shopOrderStatusEnum = pgEnum("shop_order_status", [
  "pending",
  "approved",
  "rejected",
  "cancelled",
]);
export const rewardKindEnum = pgEnum("reward_kind", ["physical", "privilege"]);
export const rewardStatusEnum = pgEnum("reward_status", ["available", "requested", "redeemed", "revoked"]);
export const rewardSourceEnum = pgEnum("reward_source", ["purchase", "gift"]);

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
    index("passport_records_type_week_student_idx").on(
      table.type,
      table.week,
      table.studentId,
    ),
  ],
);

/** v2 護照：每學期每位學生、國語／英語各一筆完成任務。 */
export const termPassportRecords = pgTable(
  "term_passport_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    termId: uuid("term_id").notNull().references(() => terms.id),
    studentId: uuid("student_id").notNull().references(() => students.id),
    type: passportTypeEnum("type").notNull(),
    completed: boolean("completed").notNull().default(false),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("term_passport_records_term_student_type_uidx").on(table.termId, table.studentId, table.type)],
);
export const termPassportHistory = pgTable("term_passport_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  passportRecordId: uuid("passport_record_id").notNull().references(() => termPassportRecords.id),
  previousCompleted: boolean("previous_completed"),
  nextCompleted: boolean("next_completed").notNull(),
  actor: text("actor").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const homeworkBooks = pgTable(
  "homework_books",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    subjectId: uuid("subject_id").references(() => homeworkSubjects.id),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (table) => [uniqueIndex("homework_books_name_uidx").on(table.name)],
);

/** 作業科目；簿本／教材可隸屬於一個科目。 */
export const homeworkSubjects = pgTable(
  "homework_subjects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (table) => [uniqueIndex("homework_subjects_name_uidx").on(table.name)],
);

export const homework = pgTable("homework", {
  id: uuid("id").defaultRandom().primaryKey(),
  bookId: uuid("book_id")
    .notNull()
    .references(() => homeworkBooks.id),
  /** 頁數／課次自由文字，例：12-15、12,14、第3課 */
  pageLabel: text("page_label").notNull(),
  /** 繳交日 */
  date: date("date").notNull(),
  /** 聯絡簿上寫的那一天（可與繳交日不同） */
  contactBookDate: date("contact_book_date"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}, (table) => [
  index("homework_date_idx").on(table.date),
  index("homework_contact_book_date_idx").on(table.contactBookDate),
]);

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
    status: homeworkStatusEnum("status").notNull().default("unsubmitted"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("homework_records_homework_student_uidx").on(
      table.homeworkId,
      table.studentId,
    ),
  ],
);

export const homeworkRecordHistory = pgTable(
  "homework_record_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    homeworkId: uuid("homework_id").notNull().references(() => homework.id),
    studentId: uuid("student_id").notNull().references(() => students.id),
    previousStatus: homeworkStatusEnum("previous_status"),
    nextStatus: homeworkStatusEnum("next_status").notNull(),
    actor: text("actor").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("homework_record_history_record_idx").on(table.homeworkId, table.studentId)],
);

/** 學期主檔；歷史學期保留，僅一個可啟用。 */
export const terms = pgTable(
  "terms",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    schoolYear: text("school_year").notNull(),
    startsOn: date("starts_on").notNull(),
    endsOn: date("ends_on").notNull(),
    isActive: boolean("is_active").notNull().default(false),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("terms_school_year_name_uidx").on(table.schoolYear, table.name),
  ],
);

/** 每學期的名冊與座號快照，避免新學期調整覆蓋舊學期。 */
export const termRosterEntries = pgTable(
  "term_roster_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    termId: uuid("term_id")
      .notNull()
      .references(() => terms.id),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id),
    seatNumber: integer("seat_number").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("term_roster_entries_term_student_uidx").on(table.termId, table.studentId),
    uniqueIndex("term_roster_entries_term_seat_uidx").on(table.termId, table.seatNumber),
  ],
);

export const classSettings = pgTable("class_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  schoolYear: text("school_year").notNull(),
  grade: integer("grade").notNull(),
  className: text("class_name").notNull(),
  activeTermId: uuid("active_term_id").references(() => terms.id),
  currentWeek: integer("current_week").notNull(),
  chineseStartWeek: integer("chinese_start_week").notNull().default(3),
  chineseEndWeek: integer("chinese_end_week").notNull().default(16),
  englishStartWeek: integer("english_start_week").notNull().default(3),
  englishEndWeek: integer("english_end_week").notNull().default(16),
  /** 第一週開始日（YYYY-MM-DD）；空白＝手動目前週數 */
  weekOneStartDate: text("week_one_start_date").notNull().default(""),
  /** 學期結束日（YYYY-MM-DD，含當日）；空白＝僅用週數上限推斷 */
  termEndDate: text("term_end_date").notNull().default(""),
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
  /** 閱讀紀錄：學年度（可與班級學年度不同） */
  readingSchoolYear: text("reading_school_year").notNull().default(""),
  /** 閱讀紀錄：上／下學期 */
  readingSemester: text("reading_semester").notNull().default("first"),
  /** 大屏：允許學生自助點閱讀總表 */
  allowDisplayReadingToggle: boolean("allow_display_reading_toggle")
    .notNull()
    .default(false),
  /** 大屏：面板自動輪播 */
  displayCarouselEnabled: boolean("display_carousel_enabled")
    .notNull()
    .default(false),
  /** 舊版大屏明文 token；啟動時遷移為雜湊後清空 */
  displayToken: text("display_token").notNull().default(""),
  /** 大屏存取碼 SHA-256 雜湊（空字串＝尚未設定） */
  displayTokenHash: text("display_token_hash").notNull().default(""),
  /** 大屏輪詢秒數 */
  displayRefreshSeconds: integer("display_refresh_seconds")
    .notNull()
    .default(20),
  /** 大屏聯絡簿顯示日（空白＝跟系統今天） */
  displayContactBookDate: text("display_contact_book_date")
    .notNull()
    .default(""),
  shopOpen: boolean("shop_open").notNull().default(false),
  /** 午餐大屏影音：歌曲名稱或 YouTube 網址；空白時不播放 */
  lunchVideoQuery: text("lunch_video_query").notNull().default(""),
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

/** 聯絡簿當日叮嚀（JSON 陣列字串；不進作業打勾） */
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

/** 週一至週五的聯絡簿範本，內容可於套用後繼續調整。 */
export const contactBookTemplates = pgTable(
  "contact_book_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    weekday: integer("weekday").notNull(),
    notes: text("notes").notNull().default("[]"),
    assignments: text("assignments").notNull().default("[]"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("contact_book_templates_weekday_uidx").on(table.weekday)],
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

/** 當日缺席；僅從每日任務的待完成名單排除，不影響作業繳交。 */
export const dailyAbsences = pgTable(
  "daily_absences",
  {
    taskDate: date("task_date").notNull(),
    studentId: uuid("student_id").notNull().references(() => students.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("daily_absences_date_student_uidx").on(table.taskDate, table.studentId)],
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

/** 班級行事曆：特殊活動／節日（可整天或時段） */
export const calendarEvents = pgTable("calendar_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  date: date("date").notNull(),
  title: text("title").notNull(),
  allDay: boolean("all_day").notNull().default(true),
  /** HH:MM，非整天時必填 */
  startTime: text("start_time"),
  /** HH:MM，選填 */
  endTime: text("end_time"),
  sortOrder: integer("sort_order").notNull().default(0),
  ...timestamps,
}, (table) => [index("calendar_events_date_idx").on(table.date)]);

/** 單日放假覆寫（無列＝六日放假、平日上課） */
export const calendarDayOverrides = pgTable(
  "calendar_day_overrides",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    date: date("date").notNull(),
    isHoliday: boolean("is_holiday").notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("calendar_day_overrides_date_uidx").on(table.date)],
);

/** 值日工作人工覆寫（交換後寫入；無列＝演算法自動） */
export const dutyOverrides = pgTable(
  "duty_overrides",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    date: date("date").notNull(),
    slotKey: text("slot_key").notNull(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("duty_overrides_date_slot_uidx").on(table.date, table.slotKey),
  ],
);

/** 讀報／閱讀心得（學期月份；1,2,7,8 不計） */
export const readingTypeEnum = pgEnum("reading_type", [
  "newspaper",
  "reflection",
]);

export const gameCurrencyEnum = pgEnum("game_currency", ["xp", "coins"]);

export const readingRecords = pgTable(
  "reading_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id),
    type: readingTypeEnum("type").notNull(),
    schoolYear: text("school_year").notNull(),
    /** first=上學期(9–1)｜second=下學期(2–6) */
    semester: text("semester").notNull(),
    month: integer("month").notNull(),
    status: passportStatusEnum("status").notNull().default("not_started"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("reading_records_student_type_term_month_uidx").on(
      table.studentId,
      table.type,
      table.schoolYear,
      table.semester,
      table.month,
    ),
    index("reading_records_type_term_student_idx").on(
      table.type,
      table.schoolYear,
      table.semester,
      table.studentId,
    ),
  ],
);

/** 養成系統規則；MVP 單班固定使用 id=default。 */
export const gamificationSettings = pgTable("gamification_settings", {
  id: text("id").primaryKey().default("default"),
  enabledAt: timestamp("enabled_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  homeworkOnTimeCoins: integer("homework_on_time_coins").notNull().default(2),
  homeworkLateCoins: integer("homework_late_coins").notNull().default(1),
  homeworkMissedCoins: integer("homework_missed_coins").notNull().default(-1),
  passportOnTimeCoins: integer("passport_on_time_coins").notNull().default(5),
  passportLateCoins: integer("passport_late_coins").notNull().default(2),
  passportMissedCoins: integer("passport_missed_coins").notNull().default(-2),
  routineXp: integer("routine_xp").notNull().default(2),
  levelBaseXp: integer("level_base_xp").notNull().default(100),
  ...timestamps,
});

/** 快速讀取用投影；coin_net 可為負，畫面顯示時最低為 0。 */
export const studentGameProfiles = pgTable("student_game_profiles", {
  studentId: uuid("student_id")
    .primaryKey()
    .references(() => students.id),
  xpTotal: integer("xp_total").notNull().default(0),
  coinNet: integer("coin_net").notNull().default(0),
  startedAt: timestamp("started_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  ...timestamps,
});

/**
 * 每個來源目前生效的效果。effect_key 唯一，重送同一狀態不會再次加扣。
 * amount=0 代表效果已回沖，但保留歷史身份供之後再次切換。
 */
export const gamificationEffects = pgTable(
  "gamification_effects",
  {
    effectKey: text("effect_key").primaryKey(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id),
    currency: gameCurrencyEnum("currency").notNull(),
    sourceType: text("source_type").notNull(),
    sourceId: text("source_id").notNull(),
    effectType: text("effect_type").notNull(),
    amount: integer("amount").notNull().default(0),
    ruleSnapshot: text("rule_snapshot").notNull().default("{}"),
    ...timestamps,
  },
  (table) => [
    index("gamification_effects_student_idx").on(table.studentId),
    index("gamification_effects_source_idx").on(
      table.sourceType,
      table.sourceId,
    ),
  ],
);

/** 不可變更的增減帳本；所有回沖都追加反向 delta。 */
export const gamificationLedger = pgTable(
  "gamification_ledger",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id),
    effectKey: text("effect_key").notNull(),
    currency: gameCurrencyEnum("currency").notNull(),
    delta: integer("delta").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    reason: text("reason").notNull(),
    metadata: text("metadata").notNull().default("{}"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("gamification_ledger_student_created_idx").on(
      table.studentId,
      table.createdAt,
    ),
  ],
);

export const shopItems = pgTable("shop_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  icon: text("icon").notNull().default("🎁"),
  price: integer("price").notNull(),
  kind: rewardKindEnum("kind").notNull().default("physical"),
  description: text("description").notNull().default(""),
  /** -1 代表無限供應 */
  stock: integer("stock").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps,
});

/** 每一筆是學生真正持有的一份獎品；保留快照以支援商品下架後查閱歷史。 */
export const studentRewards = pgTable(
  "student_rewards",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentId: uuid("student_id").notNull().references(() => students.id),
    itemId: uuid("item_id").references(() => shopItems.id),
    itemName: text("item_name").notNull(),
    itemIcon: text("item_icon").notNull().default("🎁"),
    kind: rewardKindEnum("kind").notNull(),
    description: text("description").notNull().default(""),
    pricePaid: integer("price_paid").notNull().default(0),
    source: rewardSourceEnum("source").notNull(),
    status: rewardStatusEnum("status").notNull().default("available"),
    requestedAt: timestamp("requested_at", { withTimezone: true }),
    redeemedAt: timestamp("redeemed_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("student_rewards_student_status_idx").on(table.studentId, table.status),
    index("student_rewards_status_requested_idx").on(table.status, table.requestedAt),
  ],
);

export const studentRewardHistory = pgTable(
  "student_reward_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    rewardId: uuid("reward_id").notNull().references(() => studentRewards.id),
    action: text("action").notNull(),
    actor: text("actor").notNull(),
    note: text("note").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("student_reward_history_reward_idx").on(table.rewardId, table.createdAt)],
);

export const shopOrders = pgTable(
  "shop_orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    itemId: uuid("item_id").notNull().references(() => shopItems.id),
    studentId: uuid("student_id").notNull().references(() => students.id),
    price: integer("price").notNull(),
    status: shopOrderStatusEnum("status").notNull().default("pending"),
    requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedBy: text("resolved_by"),
  },
  (table) => [index("shop_orders_status_idx").on(table.status, table.requestedAt)],
);

export type Student = typeof students.$inferSelect;
export type NewStudent = typeof students.$inferInsert;
export type PassportRecord = typeof passportRecords.$inferSelect;
export type HomeworkBook = typeof homeworkBooks.$inferSelect;
export type HomeworkSubject = typeof homeworkSubjects.$inferSelect;
export type Homework = typeof homework.$inferSelect;
export type HomeworkRecord = typeof homeworkRecords.$inferSelect;
export type ClassSettings = typeof classSettings.$inferSelect;
export type DailyTaskCompletion = typeof dailyTaskCompletions.$inferSelect;
export type ContactBookDay = typeof contactBookDays.$inferSelect;
export type DailyStudentTask = typeof dailyStudentTasks.$inferSelect;
export type TodayManualCompletion = typeof todayManualCompletions.$inferSelect;
export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type NewCalendarEvent = typeof calendarEvents.$inferInsert;
export type CalendarDayOverride = typeof calendarDayOverrides.$inferSelect;
export type Term = typeof terms.$inferSelect;
export type TermRosterEntry = typeof termRosterEntries.$inferSelect;
export type DutyOverride = typeof dutyOverrides.$inferSelect;
export type ReadingRecord = typeof readingRecords.$inferSelect;
export type StudentReward = typeof studentRewards.$inferSelect;
export type GamificationSettings = typeof gamificationSettings.$inferSelect;
export type StudentGameProfile = typeof studentGameProfiles.$inferSelect;
export type GamificationEffect = typeof gamificationEffects.$inferSelect;
export type GamificationLedgerEntry = typeof gamificationLedger.$inferSelect;
export type ShopItem = typeof shopItems.$inferSelect;
export type ShopOrder = typeof shopOrders.$inferSelect;
