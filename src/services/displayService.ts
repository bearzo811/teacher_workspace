import { monthDateRange, todayDateString } from "@/lib/dates";
import { formatWeekProgress, resolveSchoolWeek } from "@/lib/schoolWeek";
import {
  listCalendarCountdown,
  listCalendarEventsByDate,
  listCalendarEventsInRange,
  listHolidayOverridesInRange,
} from "@/services/calendarService";
import { getClassSettings } from "@/services/classSettingsService";
import { getContactBook } from "@/services/contactBookService";
import { getDutyDay, getDutyLeaders } from "@/services/dutyService";
import { getHomeworkDayView, listStudentHomeworkDebts } from "@/services/homeworkService";
import { getPassportMatrix, getPassportWeekView } from "@/services/passportService";
import { getReadingMatrix } from "@/services/readingService";
import {
  getStudentTaskMap,
  getTaskCompletionCount,
  listActiveStudents,
} from "@/services/routineService";
import type { DisplayData, DisplayDebtItem, DisplayDebtRow } from "@/types/display";
import { DAILY_STUDENT_TASK_LABEL } from "@/types/today";
import type { PassportMatrixView } from "@/services/passportService";
import type { ReadingMatrixView } from "@/types/reading";

export type { DisplayData };

function passportDebts(
  matrix: PassportMatrixView,
  studentId: string,
): DisplayDebtItem[] {
  const student = matrix.students.find((row) => row.studentId === studentId);
  if (!student) return [];
  return student.cells
    .filter(
      (cell) =>
        cell.week <= matrix.currentWeek && cell.status !== "completed",
    )
    .map((cell) => ({
      label: `W${cell.week}`,
      note: cell.status === "missing_parent" ? "缺家長" : undefined,
    }));
}

function readingDebts(
  matrix: ReadingMatrixView,
  studentId: string,
  asOfMonth: number,
): DisplayDebtItem[] {
  const student = matrix.students.find((row) => row.studentId === studentId);
  if (!student) return [];
  return student.cells
    // 當月 1 日起才列該月；未來月份不提前算欠繳。
    .filter(
      (cell) => cell.month <= asOfMonth && cell.status !== "completed",
    )
    .map((cell) => ({
      label: `${cell.month}月`,
      note: cell.status === "missing_parent" ? "缺家長" : undefined,
    }));
}

/**
 * Classroom display aggregation — Single Source of Truth for /display.
 * @param options.contactBookDate 覆寫聯絡簿日（否則用設定或今天）
 */
export async function getDisplayData(options?: {
  contactBookDate?: string;
}): Promise<DisplayData> {
  const settings = await getClassSettings();
  const today = todayDateString();
  const override = options?.contactBookDate?.trim() ?? "";
  const contactBookDate =
    override || settings.displayContactBookDate.trim() || today;
  const [year, month] = today.split("-").map(Number);
  const { from, to } = monthDateRange(year, month);

  // 黑板顯示的是所選日期，週次也要跟著那天算
  const contactBookWeekLabel = formatWeekProgress(
    resolveSchoolWeek({
      weekOneStartDate: settings.weekOneStartDate,
      termEndDate: settings.termEndDate,
      fallbackWeek: settings.currentWeek,
      today: contactBookDate,
    }),
    settings.totalWeeks,
  );

  const [
    contactBook,
    dutyLeaders,
    dutyToday,
    calendarEvents,
    calendarMonthEvents,
    calendarHolidayOverrides,
    calendarCountdown,
    homework,
    homeworkDebts,
    chinese,
    english,
    chineseMatrix,
    englishMatrix,
    readingNewspaper,
    readingReflection,
    activeStudents,
    copied,
    morning,
    brushing,
    noon,
  ] = await Promise.all([
    getContactBook(contactBookDate),
    getDutyLeaders(contactBookDate),
    getDutyDay(contactBookDate),
    listCalendarEventsByDate(contactBookDate),
    listCalendarEventsInRange(from, to),
    listHolidayOverridesInRange(from, to),
    listCalendarCountdown({ fromDate: today, limit: 8, withinDays: 120 }),
    getHomeworkDayView(today),
    listStudentHomeworkDebts(today),
    getPassportWeekView("Chinese", settings.schoolWeek.week),
    getPassportWeekView("English", settings.schoolWeek.week),
    getPassportMatrix("Chinese"),
    getPassportMatrix("English"),
    getReadingMatrix("newspaper"),
    getReadingMatrix("reflection"),
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

  const debts: DisplayDebtRow[] = activeStudents.map((student) => {
    const homeworkItems = (homeworkDebts.get(student.studentId) ?? []).map(
      (label) => ({ label }),
    );
    const chinesePassport = passportDebts(chineseMatrix, student.studentId);
    const englishPassport = passportDebts(englishMatrix, student.studentId);
    const newspaper = readingDebts(
      readingNewspaper,
      student.studentId,
      month,
    );
    const reflection = readingDebts(
      readingReflection,
      student.studentId,
      month,
    );
    const hasDebt =
      homeworkItems.length > 0 ||
      chinesePassport.length > 0 ||
      englishPassport.length > 0 ||
      newspaper.length > 0 ||
      reflection.length > 0;
    return {
      studentId: student.studentId,
      name: student.name,
      seatNumber: student.seatNumber,
      homework: homeworkItems,
      chinesePassport,
      englishPassport,
      newspaper,
      reflection,
      hasDebt,
    };
  });

  return {
    className: settings.className,
    schoolYear: settings.schoolYear,
    today,
    weekProgressLabel: settings.weekProgressLabel,
    totalWeeks: settings.totalWeeks,
    currentWeek: settings.schoolWeek.week,
    contactBook: {
      date: contactBook.date,
      dueDate: contactBook.dueDate,
      notes: contactBook.notes,
      titles: contactBook.titles,
      dutyLeaders: dutyLeaders.map((leader) => ({
        name: leader.name,
        seatNumber: leader.seatNumber,
      })),
      followsSystemToday: !settings.displayContactBookDate.trim(),
      weekProgressLabel: contactBookWeekLabel,
    },
    calendarEvents,
    calendarMonth: {
      year,
      month,
      events: calendarMonthEvents,
      holidayOverrides: calendarHolidayOverrides,
    },
    calendarCountdown,
    homework,
    passport: {
      chinese,
      english,
      chineseMatrix,
      englishMatrix,
    },
    reading: {
      newspaper: readingNewspaper,
      reflection: readingReflection,
    },
    debts,
    progress: [
      {
        key: "morning_cleaning",
        label: DAILY_STUDENT_TASK_LABEL.morning_cleaning,
        completed: morning.completed,
        total: morning.total,
        missingNames: morning.missingNames,
      },
      {
        key: "contact_book_copied",
        label: "抄聯絡簿",
        completed: copied.completed,
        total: copied.total,
        missingNames: copied.missingNames,
      },
      {
        key: "homework",
        label: "作業",
        completed: homework.completedStudentCount,
        total: homework.totalStudentCount,
        missingNames: homework.students
          .filter((s) => s.missingTitles.length > 0)
          .map((s) => s.name),
      },
    ],
    lunchProgress: [
      {
        key: "lunch_brushing",
        label: "刷牙",
        completed: brushing.completed,
        total: brushing.total,
        missingNames: brushing.missingNames,
      },
      {
        key: "noon_cleaning",
        label: DAILY_STUDENT_TASK_LABEL.noon_cleaning,
        completed: noon.completed,
        total: noon.total,
        missingNames: noon.missingNames,
      },
    ],
    dutyToday: {
      date: dutyToday.date,
      isHoliday: dutyToday.isHoliday,
      slots: dutyToday.slots.map((slot) => ({
        slotKey: slot.slotKey,
        label: slot.label,
        name: slot.name,
        seatNumber: slot.seatNumber,
      })),
      leaders: dutyToday.leaders.map((leader) => ({
        name: leader.name,
        seatNumber: leader.seatNumber,
      })),
    },
    personal: personalByStudent,
    displaySettings: {
      allowStudentHomeworkToggle: settings.allowDisplayHomeworkToggle,
      allowStudentPassportToggle: settings.allowDisplayPassportToggle,
      allowStudentRoutineToggle: settings.allowDisplayRoutineToggle,
      allowStudentReadingToggle: settings.allowDisplayReadingToggle,
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
  // week 範圍由 upsertPassportStatus 檢查；允許改他週以補缺漏
  void week;
}

export async function assertDisplayRoutineToggleEnabled() {
  const settings = await getClassSettings();
  if (!settings.allowDisplayRoutineToggle) {
    throw new Error("老師尚未開放大屏每日任務／已抄勾選");
  }
}

export async function assertDisplayReadingToggleEnabled() {
  const settings = await getClassSettings();
  if (!settings.allowDisplayReadingToggle) {
    throw new Error("老師尚未開放大屏閱讀總表點選");
  }
}

export type { DailyStudentTaskKey } from "@/types/today";
