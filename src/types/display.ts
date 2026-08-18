import type {
  CalendarCountdownItem,
  CalendarEventView,
} from "@/types/calendar";
import type { HomeworkDayView } from "@/services/homeworkService";
import type {
  PassportMatrixView,
  PassportWeekView,
} from "@/services/passportService";
import type { PassportStatus } from "@/types/passport";
import type { ReadingMatrixView } from "@/types/reading";
import type { GamificationView } from "@/types/gamification";

export type DisplayPersonalRow = {
  studentId: string;
  name: string;
  seatNumber: number;
  contactBookCopied: boolean;
  morningCleaning: boolean;
  lunchBrushing: boolean;
  noonCleaning: boolean;
  chinesePassport: PassportStatus;
  englishPassport: PassportStatus;
  termChinesePassportCompleted: boolean;
  termEnglishPassportCompleted: boolean;
  homeworkAllDone: boolean;
  homeworkMissing: string[];
  gamification: GamificationView;
};

export type DisplayDebtItem = {
  label: string;
  /** missing_parent 時標示 */
  note?: string;
  /** 作業才有四種繳交狀態；其餘項目只有完成／未完成。 */
  status?: "unsubmitted" | "pending_confirmation" | "correction_required" | "completed";
};

export type DisplayDebtRow = {
  studentId: string;
  name: string;
  seatNumber: number;
  homework: DisplayDebtItem[];
  chinesePassport: DisplayDebtItem[];
  englishPassport: DisplayDebtItem[];
  newspaper: DisplayDebtItem[];
  reflection: DisplayDebtItem[];
  /** 尚有待處理或待老師確認的項目。 */
  hasDebt: boolean;
  /** 學生仍須自己完成的項目；此狀態才限制下課與商店。 */
  hasBlockingDebt: boolean;
};

export type DisplayProgressItem = {
  key: string;
  label: string;
  completed: number;
  total: number;
  missingNames: string[];
};

export type DisplayBackpackItem = {
  id: string; itemId: string | null; itemName: string; itemIcon: string;
  kind: "physical" | "privilege"; description: string;
  status: "available" | "requested" | "redeemed" | "revoked";
};
export type DisplayBackpackRow = { studentId: string; name: string; seatNumber: number; items: DisplayBackpackItem[] };

export type DisplayData = {
  /** 資料版本；供大屏以低成本輪詢變更。 */
  version: string;
  className: string;
  schoolYear: string;
  today: string;
  /** 例如「第 8 週」 */
  weekProgressLabel: string;
  totalWeeks: number | null;
  currentWeek: number;
  contactBook: {
    date: string;
    dueDate: string;
    notes: string[];
    titles: string[];
    /** 今日值日生（抬餐桶） */
    dutyLeaders: { name: string; seatNumber: number }[];
    /** 設定空白＝跟系統今天（大屏選日後會寫入設定） */
    followsSystemToday: boolean;
    /** 依聯絡簿日期算的週次，例「第 8 週」 */
    weekProgressLabel: string;
  };
  calendarEvents: CalendarEventView[];
  calendarMonth: {
    year: number;
    month: number;
    events: CalendarEventView[];
    holidayOverrides: Record<string, boolean>;
  };
  calendarCountdown: CalendarCountdownItem[];
  homework: HomeworkDayView;
  passport: {
    chinese: PassportWeekView;
    english: PassportWeekView;
    chineseMatrix: PassportMatrixView;
    englishMatrix: PassportMatrixView;
  };
  reading: {
    newspaper: ReadingMatrixView;
    reflection: ReadingMatrixView;
  };
  /** 各生欠繳：作業／護照／讀報心得 */
  debts: DisplayDebtRow[];
  /** 首頁今日進度（不含午餐刷牙／中午打掃） */
  progress: DisplayProgressItem[];
  /** 午餐頁進度：刷牙、中午打掃 */
  lunchProgress: DisplayProgressItem[];
  lunchVideoQuery: string;
  /** 今日中午值日工作分配 */
  dutyToday: {
    date: string;
    isHoliday: boolean;
    slots: {
      slotKey: string;
      label: string;
      name: string | null;
      seatNumber: number | null;
    }[];
    leaders: { name: string; seatNumber: number }[];
  };
  personal: DisplayPersonalRow[];
  shop: {
    open: boolean;
    items: { id: string; name: string; icon: string; price: number; stock: number; kind: "physical" | "privilege"; description: string }[];
  };
  backpacks: DisplayBackpackRow[];
  displaySettings: {
    allowStudentHomeworkToggle: boolean;
    allowStudentPassportToggle: boolean;
    allowStudentRoutineToggle: boolean;
    allowStudentReadingToggle: boolean;
    carouselEnabled: boolean;
    refreshSeconds: number;
    hasToken: boolean;
  };
  students: { studentId: string; name: string; seatNumber: number }[];
};
