/**
 * 清空除 students 外的所有業務資料，並將 class_settings 恢復預設。
 * 用法：npx tsx scripts/reset-data-keep-students.ts
 */
import { config } from "dotenv";
import postgres from "postgres";

config({ path: process.env.ENV_FILE || ".env.local" });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL 未設定（請確認 .env.local）");
  process.exit(1);
}

const DEFAULT_CLASS_SETTINGS = {
  school_year: "115",
  grade: 4,
  class_name: "四年甲班",
  current_week: 1,
  chinese_start_week: 3,
  chinese_end_week: 16,
  english_start_week: 3,
  english_end_week: 16,
  week_one_start_date: "",
  term_end_date: "",
  allow_display_homework_toggle: false,
  allow_display_passport_toggle: false,
  allow_display_routine_toggle: false,
  reading_school_year: "",
  reading_semester: "first",
  allow_display_reading_toggle: false,
  display_carousel_enabled: false,
  display_token: "",
  display_token_hash: "",
  display_refresh_seconds: 20,
  display_contact_book_date: "",
  shop_open: false,
};

const sql = postgres(connectionString, { prepare: false, max: 1 });

async function main() {
  const [{ count: studentCount }] =
    await sql`SELECT count(*)::int AS count FROM students`;

  console.log(`保留學生 ${studentCount} 人，開始清空其他資料…`);

  await sql.begin(async (tx) => {
    await tx`DELETE FROM student_reward_history`;
    await tx`DELETE FROM student_rewards`;
    await tx`DELETE FROM shop_orders`;
    await tx`DELETE FROM shop_items`;
    await tx`DELETE FROM gamification_ledger`;
    await tx`DELETE FROM gamification_effects`;
    await tx`DELETE FROM homework_record_history`;
    await tx`DELETE FROM homework_records`;
    await tx`DELETE FROM homework`;
    await tx`DELETE FROM homework_books`;
    await tx`DELETE FROM homework_subjects`;
    await tx`DELETE FROM term_passport_history`;
    await tx`DELETE FROM term_passport_records`;
    await tx`DELETE FROM passport_records`;
    await tx`DELETE FROM reading_records`;
    await tx`DELETE FROM daily_student_tasks`;
    await tx`DELETE FROM daily_absences`;
    await tx`DELETE FROM duty_overrides`;
    await tx`DELETE FROM today_manual_completions`;
    await tx`DELETE FROM daily_task_completions`;
    await tx`DELETE FROM contact_book_days`;
    await tx`DELETE FROM contact_book_templates`;
    await tx`DELETE FROM calendar_events`;
    await tx`DELETE FROM calendar_day_overrides`;
    await tx`DELETE FROM class_settings`;
    await tx`DELETE FROM term_roster_entries`;
    await tx`DELETE FROM terms`;
    await tx`DELETE FROM student_game_profiles`;
    await tx`DELETE FROM gamification_settings`;

    await tx`
      INSERT INTO class_settings (
        school_year,
        grade,
        class_name,
        current_week,
        chinese_start_week,
        chinese_end_week,
        english_start_week,
        english_end_week,
        week_one_start_date,
        term_end_date,
        allow_display_homework_toggle,
        allow_display_passport_toggle,
        allow_display_routine_toggle,
        reading_school_year,
        reading_semester,
        allow_display_reading_toggle,
        display_carousel_enabled,
        display_token,
        display_token_hash,
        display_refresh_seconds,
        display_contact_book_date,
        shop_open
      ) VALUES (
        ${DEFAULT_CLASS_SETTINGS.school_year},
        ${DEFAULT_CLASS_SETTINGS.grade},
        ${DEFAULT_CLASS_SETTINGS.class_name},
        ${DEFAULT_CLASS_SETTINGS.current_week},
        ${DEFAULT_CLASS_SETTINGS.chinese_start_week},
        ${DEFAULT_CLASS_SETTINGS.chinese_end_week},
        ${DEFAULT_CLASS_SETTINGS.english_start_week},
        ${DEFAULT_CLASS_SETTINGS.english_end_week},
        ${DEFAULT_CLASS_SETTINGS.week_one_start_date},
        ${DEFAULT_CLASS_SETTINGS.term_end_date},
        ${DEFAULT_CLASS_SETTINGS.allow_display_homework_toggle},
        ${DEFAULT_CLASS_SETTINGS.allow_display_passport_toggle},
        ${DEFAULT_CLASS_SETTINGS.allow_display_routine_toggle},
        ${DEFAULT_CLASS_SETTINGS.reading_school_year},
        ${DEFAULT_CLASS_SETTINGS.reading_semester},
        ${DEFAULT_CLASS_SETTINGS.allow_display_reading_toggle},
        ${DEFAULT_CLASS_SETTINGS.display_carousel_enabled},
        ${DEFAULT_CLASS_SETTINGS.display_token},
        ${DEFAULT_CLASS_SETTINGS.display_token_hash},
        ${DEFAULT_CLASS_SETTINGS.display_refresh_seconds},
        ${DEFAULT_CLASS_SETTINGS.display_contact_book_date},
        ${DEFAULT_CLASS_SETTINGS.shop_open}
      )
    `;
    await tx`
      INSERT INTO gamification_settings (id) VALUES ('default')
    `;
    await tx`
      INSERT INTO student_game_profiles (student_id)
      SELECT id FROM students
    `;
  });

  console.log(
    "完成：保留學生名冊；其餘作業／聯絡簿／護照／閱讀／行事曆／值日／每日任務／商店／養成資料均已清空",
  );
  console.log("class_settings 已恢復空白初始狀態（115 學年、四年甲班、第 1 週）");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await sql.end({ timeout: 5 });
  });
