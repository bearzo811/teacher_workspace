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
import { getGamificationForStudents } from "@/services/gamificationService";
import {
  getHomeworkDayView,
  listStudentHomeworkDebts,
} from "@/services/homeworkService";
import {
  getPassportMatrix,
  getPassportWeekView,
} from "@/services/passportService";
import { getReadingMatrix } from "@/services/readingService";
import {
  getDailyStudentTaskMaps,
  getAbsentStudentIds,
  listActiveStudents,
} from "@/services/routineService";
import { listShopItems, listStudentRewards } from "@/services/shopService";
import { getTermPassportView } from "@/services/termPassportService";
import type {
  DisplayData,
  DisplayDebtItem,
  DisplayDebtRow,
} from "@/types/display";
import {
  DAILY_STUDENT_TASK_LABEL,
  type DailyStudentTaskKey,
} from "@/types/today";
import type { PassportMatrixView } from "@/services/passportService";
import type { ReadingMatrixView } from "@/types/reading";

export type { DisplayData };

const DISPLAY_CACHE_MS = 15_000;
const displayCache = new Map<
  string,
  { version: string; expiresAt: number; data: DisplayData }
>();

function passportDebts(
  matrix: PassportMatrixView,
  studentId: string,
): DisplayDebtItem[] {
  const student = matrix.students.find((row) => row.studentId === studentId);
  if (!student) return [];
  return student.cells
    .filter(
      (cell) => cell.week <= matrix.currentWeek && cell.status !== "completed",
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
  const dueMonths = (() => {
    if (matrix.semester === "first") {
      // 上學期跨年度：9～12 月依序到期，1 月才補上 1 月任務；7、8 月不算欠繳。
      if (asOfMonth >= 9 && asOfMonth <= 12) {
        return new Set(Array.from({ length: asOfMonth - 8 }, (_, index) => index + 9));
      }
      if (asOfMonth === 1) return new Set([9, 10, 11, 12, 1]);
      return new Set<number>();
    }
    // 下學期為同一年 2～6 月；其餘月份不列欠繳。
    if (asOfMonth >= 2 && asOfMonth <= 6) {
      return new Set(Array.from({ length: asOfMonth - 1 }, (_, index) => index + 2));
    }
    return new Set<number>();
  })();
  return (
    student.cells
      // 只列本學期目前已到期的月份；跨年的上學期不可直接比較月份數字。
      .filter((cell) => dueMonths.has(cell.month) && cell.status !== "completed")
      .map((cell) => ({
        label: `${cell.month}月`,
        note: cell.status === "missing_parent" ? "缺家長" : undefined,
      }))
  );
}

/**
 * Classroom display aggregation — Single Source of Truth for /display.
 * @param options.contactBookDate 覆寫聯絡簿日（否則用設定或今天）
 */
export async function getDisplayData(options?: {
  contactBookDate?: string;
}): Promise<DisplayData> {
  const settings = await getClassSettings();
  const version = settings.updatedAt.toISOString();
  const cacheKey = options?.contactBookDate?.trim() || "system-today";
  const cached = displayCache.get(cacheKey);
  if (
    cached &&
    cached.version === version &&
    cached.expiresAt > Date.now()
  ) {
    return cached.data;
  }

  const data = await buildDisplayData(options, settings);
  displayCache.set(cacheKey, {
    version,
    expiresAt: Date.now() + DISPLAY_CACHE_MS,
    data,
  });
  return data;
}

async function buildDisplayData(options: {
  contactBookDate?: string;
} | undefined, settings: Awaited<ReturnType<typeof getClassSettings>>): Promise<DisplayData> {
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

  // 黑板右側的作業進度必須對應這張聯絡簿的繳交日，
  // 不能固定查系統今天，否則週末／跨日會顯示空白。
  const contactBook = await getContactBook(contactBookDate);

  const [
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
    studentTaskMaps,
    absentStudentIds,
    shopItems,
    rewards,
    termChinesePassport,
    termEnglishPassport,
  ] = await Promise.all([
    getDutyLeaders(contactBookDate),
    getDutyDay(contactBookDate),
    listCalendarEventsByDate(contactBookDate),
    listCalendarEventsInRange(from, to),
    listHolidayOverridesInRange(from, to),
    listCalendarCountdown({ fromDate: today, limit: 8, withinDays: 365 }),
    // 大屏黑板可顯示今天要抄的聯絡簿；但學生座號區要勾的是「今天到期」、
    // 也就是前一個上課日抄寫的作業，兩者不能共用聯絡簿的繳交日。
    getHomeworkDayView(today),
    listStudentHomeworkDebts(today),
    getPassportWeekView("Chinese", settings.schoolWeek.week),
    getPassportWeekView("English", settings.schoolWeek.week),
    getPassportMatrix("Chinese"),
    getPassportMatrix("English"),
    getReadingMatrix("newspaper"),
    getReadingMatrix("reflection"),
    listActiveStudents(),
    getDailyStudentTaskMaps(today),
    getAbsentStudentIds(today),
    settings.shopOpen ? listShopItems({ activeOnly: true }) : Promise.resolve([]),
    listStudentRewards(),
    getTermPassportView("Chinese"),
    getTermPassportView("English"),
  ]);

  const emptyTasks: Record<DailyStudentTaskKey, boolean> = {
    contact_book_copied: false,
    morning_cleaning: false,
    lunch_brushing: false,
    noon_cleaning: false,
  };
  const taskCompletion = (taskKey: DailyStudentTaskKey) => {
    const eligibleStudents = activeStudents.filter((student) => !absentStudentIds.has(student.studentId));
    const completedStudents = eligibleStudents.filter(
      (student) => studentTaskMaps.get(student.studentId)?.[taskKey] ?? false,
    );
    const completedIds = new Set(
      completedStudents.map((student) => student.studentId),
    );
    return {
      completed: completedStudents.length,
      total: eligibleStudents.length,
      missingNames: eligibleStudents
        .filter((student) => !completedIds.has(student.studentId))
        .map((student) => student.name),
    };
  };
  const copied = taskCompletion("contact_book_copied");
  const morning = taskCompletion("morning_cleaning");
  const brushing = taskCompletion("lunch_brushing");
  const noon = taskCompletion("noon_cleaning");
  const gameProfiles = await getGamificationForStudents(
    activeStudents.map((student) => student.studentId),
  );
  // 大屏的「作業」是繳交統計：只有未交才算尚未繳交。
  // 待老師確認、需訂正與已完成都代表學生已經交出作業。
  const homeworkSubmission = new Map(
    homework.students.map((row) => {
      const missingTitles = row.cells
        .filter((cell) => cell.status === "unsubmitted")
        .map((cell) => cell.title);
      return [
        row.studentId,
        {
          allSubmitted: homework.items.length === 0 || missingTitles.length === 0,
          missingTitles,
        },
      ] as const;
    }),
  );

  const personalByStudent = activeStudents.map((student) => {
    const tasks = studentTaskMaps.get(student.studentId) ?? emptyTasks;
    const chineseStatus =
      chinese.students.find((s) => s.studentId === student.studentId)?.status ??
      "not_started";
    const englishStatus =
      english.students.find((s) => s.studentId === student.studentId)?.status ??
      "not_started";
    const termChinese = termChinesePassport.students.find((row) => row.studentId === student.studentId)?.completed ?? false;
    const termEnglish = termEnglishPassport.students.find((row) => row.studentId === student.studentId)?.completed ?? false;
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
      termChinesePassportCompleted: termChinese,
      termEnglishPassportCompleted: termEnglish,
      homeworkAllDone:
        homeworkSubmission.get(student.studentId)?.allSubmitted ??
        homework.items.length === 0,
      homeworkMissing:
        homeworkSubmission.get(student.studentId)?.missingTitles ?? [],
      gamification: gameProfiles.get(student.studentId)!,
    };
  });

  const debts: DisplayDebtRow[] = activeStudents.map((student) => {
    const homeworkItems = (homeworkDebts.get(student.studentId) ?? []).map(
      (item) => ({ label: item.label, status: item.status }),
    );
    const chinesePassport = passportDebts(chineseMatrix, student.studentId);
    const englishPassport = passportDebts(englishMatrix, student.studentId);
    const newspaper = readingDebts(readingNewspaper, student.studentId, month);
    const reflection = readingDebts(
      readingReflection,
      student.studentId,
      month,
    );
    const hasBlockingDebt =
      homeworkItems.some(
        (item) =>
          item.status === "unsubmitted" || item.status === "correction_required",
      ) ||
      chinesePassport.length > 0 ||
      englishPassport.length > 0 ||
      newspaper.length > 0 ||
      reflection.length > 0;
    const hasDebt =
      homeworkItems.some((item) => item.status !== "completed") ||
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
      hasBlockingDebt,
    };
  });

  return {
    version: settings.updatedAt.toISOString(),
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
        completed: [...homeworkSubmission.values()].filter(
          (row) => row.allSubmitted,
        ).length,
        total: homework.totalStudentCount,
        missingNames: homework.students
          .filter(
            (student) =>
              homeworkSubmission.get(student.studentId)?.missingTitles.length,
          )
          .map((student) => student.name),
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
    lunchVideoQuery: settings.lunchVideoQuery,
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
    shop: {
      open: settings.shopOpen,
      items: shopItems.map((item) => ({ id: item.id, name: item.name, icon: item.icon, price: item.price, stock: item.stock, kind: item.kind, description: item.description })),
    },
    backpacks: activeStudents.map((student) => ({
      studentId: student.studentId, name: student.name, seatNumber: student.seatNumber,
      items: rewards.filter((row) => row.reward.studentId === student.studentId).map(({ reward }) => ({
        id: reward.id, itemId: reward.itemId, itemName: reward.itemName, itemIcon: reward.itemIcon,
        kind: reward.kind, description: reward.description, status: reward.status,
      })),
    })),
    displaySettings: {
      allowStudentHomeworkToggle: settings.allowDisplayHomeworkToggle,
      allowStudentPassportToggle: settings.allowDisplayPassportToggle,
      allowStudentRoutineToggle: settings.allowDisplayRoutineToggle,
      // 閱讀／讀報依產品規格只由老師完成。
      allowStudentReadingToggle: false,
      carouselEnabled: settings.displayCarouselEnabled,
      refreshSeconds: Math.max(5, settings.displayRefreshSeconds || 20),
      hasToken: settings.hasDisplayToken,
    },
    students: activeStudents,
  };
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
