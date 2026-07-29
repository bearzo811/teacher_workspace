export type PassportType = "Chinese" | "English";

export type DailyTaskKey =
  | "chinese_passport"
  | "english_passport"
  | "homework";

/** Prefer Drizzle inferred types from `@/db/schema` in server code. */
export type { Student } from "@/db/schema";
