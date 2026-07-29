export type PassportType = "Chinese" | "English";

export type DailyTaskKey =
  | "chinese_passport"
  | "english_passport"
  | "homework";

export type Student = {
  id: string;
  name: string;
  seatNumber: number;
  isActive: boolean;
};
