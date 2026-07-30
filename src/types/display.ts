import type { HomeworkDayView } from "@/services/homeworkService";
import type { PassportWeekView } from "@/services/passportService";
import type { PassportStatus } from "@/types/passport";

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
  homeworkAllDone: boolean;
  homeworkMissing: string[];
};

export type DisplayProgressItem = {
  key: string;
  label: string;
  completed: number;
  total: number;
};

export type DisplayData = {
  className: string;
  schoolYear: string;
  today: string;
  contactBook: {
    date: string;
    dueDate: string;
    note: string;
    titles: string[];
  };
  homework: HomeworkDayView;
  passport: {
    chinese: PassportWeekView;
    english: PassportWeekView;
  };
  progress: DisplayProgressItem[];
  personal: DisplayPersonalRow[];
  displaySettings: {
    allowStudentHomeworkToggle: boolean;
    allowStudentPassportToggle: boolean;
    allowStudentRoutineToggle: boolean;
    carouselEnabled: boolean;
    refreshSeconds: number;
    hasToken: boolean;
  };
  students: { studentId: string; name: string; seatNumber: number }[];
};
