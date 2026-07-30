import { todayDateString } from "@/lib/dates";
import { getClassSettings } from "@/services/classSettingsService";
import { getContactBook } from "@/services/contactBookService";
import { getHomeworkDayView } from "@/services/homeworkService";
import { getPassportWeekView } from "@/services/passportService";
import {
  getStudentTaskMap,
  getTaskCompletionCount,
  listActiveStudents,
} from "@/services/routineService";
import type { DisplayData } from "@/types/display";
import { DAILY_STUDENT_TASK_LABEL } from "@/types/today";

export type { DisplayData };

/**
 * Classroom display aggregation — Single Source of Truth for /display.
 */
export async function getDisplayData(): Promise<DisplayData> {
  const settings = await getClassSettings();
  const today = todayDateString();

  const [
    contactBook,
    homework,
    chinese,
    english,
    activeStudents,
    copied,
    morning,
    brushing,
    noon,
  ] = await Promise.all([
    getContactBook(today),
    getHomeworkDayView(today),
    getPassportWeekView("Chinese", settings.currentWeek),
    getPassportWeekView("English", settings.currentWeek),
    listActiveStudents(),
    getTaskCompletionCount(today, "contact_book_copied"),
    getTaskCompletionCount(today, "morning_cleaning"),
    getTaskCompletionCount(today, "lunch_brushing"),
    getTaskCompletionCount(today, "noon_cleaning"),
  ]);

  const personalByStudent = await Promise.all(
    activeStudents.map(async (student) => {
      const tasks = await getStudentTaskMap(today, student.studentId);
      const chineseStatus =
        chinese.students.find((s) => s.studentId === student.studentId)
          ?.status ?? "not_started";
      const englishStatus =
        english.students.find((s) => s.studentId === student.studentId)
          ?.status ?? "not_started";
      const hwRow = homework.students.find(
        (s) => s.studentId === student.studentId,
      );
      return {
        studentId: student.studentId,
        name: student.name,
        seatNumber: student.seatNumber,
        contactBookCopied: tasks.contact_book_copied,
        morningCleaning: tasks.morning_cleaning,
        lunchBrushing: tasks.lunch_brushing,
        noonCleaning: tasks.noon_cleaning,
        chinesePassport: chineseStatus,
        englishPassport: englishStatus,
        homeworkAllDone: hwRow?.allDone ?? (homework.items.length === 0),
        homeworkMissing: hwRow?.missingTitles ?? [],
      };
    }),
  );

  return {
    className: settings.className,
    schoolYear: settings.schoolYear,
    today,
    contactBook: {
      date: contactBook.date,
      dueDate: contactBook.dueDate,
      note: contactBook.note,
      titles: contactBook.titles,
    },
    homework,
    passport: {
      chinese,
      english,
    },
    progress: [
      {
        key: "homework",
        label: "作業",
        completed: homework.completedStudentCount,
        total: homework.totalStudentCount,
      },
      {
        key: "chinese",
        label: "國語護照",
        completed: chinese.completedCount,
        total: chinese.totalCount,
      },
      {
        key: "english",
        label: "英語護照",
        completed: english.completedCount,
        total: english.totalCount,
      },
      {
        key: "morning_cleaning",
        label: DAILY_STUDENT_TASK_LABEL.morning_cleaning,
        completed: morning.completed,
        total: morning.total,
      },
      {
        key: "lunch_brushing",
        label: DAILY_STUDENT_TASK_LABEL.lunch_brushing,
        completed: brushing.completed,
        total: brushing.total,
      },
      {
        key: "noon_cleaning",
        label: DAILY_STUDENT_TASK_LABEL.noon_cleaning,
        completed: noon.completed,
        total: noon.total,
      },
      {
        key: "contact_book_copied",
        label: DAILY_STUDENT_TASK_LABEL.contact_book_copied,
        completed: copied.completed,
        total: copied.total,
      },
    ],
    personal: personalByStudent,
    displaySettings: {
      allowStudentHomeworkToggle: settings.allowDisplayHomeworkToggle,
      allowStudentPassportToggle: settings.allowDisplayPassportToggle,
      allowStudentRoutineToggle: settings.allowDisplayRoutineToggle,
      carouselEnabled: settings.displayCarouselEnabled,
      refreshSeconds: Math.max(5, settings.displayRefreshSeconds || 20),
      hasToken: Boolean(settings.displayToken.trim()),
    },
    students: activeStudents,
  };
}

export async function assertDisplayToken(token: string | null | undefined) {
  const settings = await getClassSettings();
  const expected = settings.displayToken.trim();
  if (!expected) return;
  if ((token ?? "").trim() !== expected) {
    throw new Error("大屏存取碼錯誤");
  }
}

export async function assertDisplayHomeworkToggleEnabled() {
  const settings = await getClassSettings();
  if (!settings.allowDisplayHomeworkToggle) {
    throw new Error("老師尚未開放大屏作業打勾");
  }
}

export async function assertDisplayPassportToggleEnabled(week: number) {
  const settings = await getClassSettings();
  if (!settings.allowDisplayPassportToggle) {
    throw new Error("老師尚未開放大屏護照點選");
  }
  if (week !== settings.currentWeek) {
    throw new Error("大屏只能修改目前週護照");
  }
}

export async function assertDisplayRoutineToggleEnabled() {
  const settings = await getClassSettings();
  if (!settings.allowDisplayRoutineToggle) {
    throw new Error("老師尚未開放大屏每日任務／已抄勾選");
  }
}

export type { DailyStudentTaskKey } from "@/types/today";
