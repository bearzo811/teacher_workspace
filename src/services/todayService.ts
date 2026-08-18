import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { contactBookDays, passportRecords, students } from "@/db/schema";
import { daysBetween, todayDateString } from "@/lib/dates";
import { getClassSettings } from "@/services/classSettingsService";
import { getContactBook } from "@/services/contactBookService";
import { getHomeworkDashboardSummary } from "@/services/homeworkService";
import { listPendingRewardRequests } from "@/services/shopService";
import {
  getTaskCompletionCount,
  upsertTodayManual,
} from "@/services/routineService";
import type { TodayManualKey } from "@/types/today";

export type { TodayManualKey };

export type TodayItemStatus = "done" | "attention" | "pending";

export type TodayItem = {
  id: string;
  period: "arrival" | "day" | "noon" | "dismissal";
  label: string;
  status: TodayItemStatus;
  completed: number | null;
  total: number | null;
  detail: string;
  missingNames: string[];
  href: string;
  /** 老師可手動確認／取消 */
  manualKey: TodayManualKey | null;
  manualCompleted: boolean;
};

export type TodayBoard = {
  date: string;
  className: string;
  weekProgressLabel: string;
  vacationCountdownLabel: string | null;
  periods: {
    period: TodayItem["period"];
    label: string;
    items: TodayItem[];
  }[];
};

function statusFromRatio(
  completed: number,
  total: number,
  forceDone = false,
): TodayItemStatus {
  if (forceDone || (total > 0 && completed >= total)) return "done";
  if (completed > 0) return "attention";
  return "pending";
}

async function passportWeekStats(type: "Chinese" | "English", week: number) {
  const active = await db
    .select({ id: students.id, name: students.name })
    .from(students)
    .where(eq(students.isActive, true));

  const records = await db
    .select({
      studentId: passportRecords.studentId,
      status: passportRecords.status,
    })
    .from(passportRecords)
    .where(
      and(eq(passportRecords.type, type), eq(passportRecords.week, week)),
    );

  const statusMap = new Map(records.map((r) => [r.studentId, r.status]));
  const missingNames: string[] = [];
  let completed = 0;
  for (const student of active) {
    if (statusMap.get(student.id) === "completed") {
      completed += 1;
    } else {
      missingNames.push(student.name);
    }
  }
  return { completed, total: active.length, missingNames };
}

export async function getTodayBoard(date = todayDateString()): Promise<TodayBoard> {
  const settings = await getClassSettings();
  const week = settings.schoolWeek.week;
  const weekLabel = settings.schoolWeek.label;
  const daysToTermEnd = settings.termEndDate
    ? daysBetween(date, settings.termEndDate)
    : -1;
  const termEndMonth = Number(settings.termEndDate.slice(5, 7));
  const vacationCountdownLabel =
    settings.schoolWeek.kind === "in_term" && daysToTermEnd >= 0
      ? `${termEndMonth >= 6 && termEndMonth <= 8 ? "暑假" : "寒假"}倒數：${daysToTermEnd} 天`
      : null;
  // 寒暑假不催護照：用夾住後的週僅在學期中
  const passportWeek =
    week > 0
      ? Math.min(
          Math.max(week, settings.chineseStartWeek),
          settings.chineseEndWeek,
        )
      : 0;

  const [
    homework,
    chinese,
    english,
    contactCopied,
    morning,
    brushing,
    noon,
    contactBook,
    contactSaved,
    pendingRewardRequests,
  ] = await Promise.all([
    getHomeworkDashboardSummary(date),
    passportWeek > 0
      ? passportWeekStats("Chinese", passportWeek)
      : Promise.resolve({ completed: 0, total: 0, missingNames: [] as string[] }),
    passportWeek > 0
      ? passportWeekStats("English", passportWeek)
      : Promise.resolve({ completed: 0, total: 0, missingNames: [] as string[] }),
    getTaskCompletionCount(date, "contact_book_copied"),
    getTaskCompletionCount(date, "morning_cleaning"),
    getTaskCompletionCount(date, "lunch_brushing"),
    getTaskCompletionCount(date, "noon_cleaning"),
    getContactBook(date),
    db
      .select({ id: contactBookDays.id })
      .from(contactBookDays)
      .where(eq(contactBookDays.date, date))
      .limit(1),
    listPendingRewardRequests(),
  ]);

  const hwCompleted = homework.hasItems ? homework.completed : 0;
  const hwTotal = homework.hasItems ? homework.total : 0;
  const hwMissing = homework.hasItems
    ? homework.missing.map((m) => m.name)
    : [];

  const contactAuto =
    contactCopied.total > 0 &&
    contactCopied.completed >= contactCopied.total;
  const contactDone = contactAuto;

  const editContactDone = contactSaved.length > 0;

  const items: TodayItem[] = [
    {
      id: "collect_homework",
      period: "arrival",
      label: "收作業",
      status: homework.hasItems
        ? statusFromRatio(hwCompleted, hwTotal)
        : "pending",
      completed: homework.hasItems ? hwCompleted : null,
      total: homework.hasItems ? hwTotal : null,
      detail: homework.hasItems
        ? hwCompleted >= hwTotal
          ? "全交"
          : `未交 ${hwTotal - hwCompleted} 人`
        : "今日尚無繳交項目",
      missingNames: hwMissing,
      href: `/homework?date=${date}`,
      manualKey: null,
      manualCompleted: false,
    },
    {
      id: "confirm_contact_book",
      period: "arrival",
      label: "確認聯絡簿",
      status: contactDone
        ? "done"
        : statusFromRatio(contactCopied.completed, contactCopied.total),
      completed: contactCopied.completed,
      total: contactCopied.total,
      detail: contactDone
        ? "全班已抄"
        : `已抄 ${contactCopied.completed}/${contactCopied.total}`,
      missingNames: contactCopied.missingNames,
      href: "/contact-book",
      manualKey: null,
      manualCompleted: false,
    },
    {
      id: "morning_cleaning",
      period: "arrival",
      label: "上午打掃",
      status: statusFromRatio(morning.completed, morning.total),
      completed: morning.completed,
      total: morning.total,
      detail: `已完成 ${morning.completed}/${morning.total}`,
      missingNames: morning.missingNames,
      href: "/routines",
      manualKey: null,
      manualCompleted: false,
    },
    {
      id: "chinese_passport",
      period: "day",
      label: "國語護照",
      status:
        passportWeek > 0
          ? statusFromRatio(chinese.completed, chinese.total)
          : "done",
      completed: passportWeek > 0 ? chinese.completed : null,
      total: passportWeek > 0 ? chinese.total : null,
      detail: passportWeek > 0 ? weekLabel : `${weekLabel}（暫停）`,
      missingNames: passportWeek > 0 ? chinese.missingNames : [],
      href: "/chinese",
      manualKey: null,
      manualCompleted: false,
    },
    {
      id: "english_passport",
      period: "day",
      label: "英語護照",
      status:
        passportWeek > 0
          ? statusFromRatio(english.completed, english.total)
          : "done",
      completed: passportWeek > 0 ? english.completed : null,
      total: passportWeek > 0 ? english.total : null,
      detail: passportWeek > 0 ? weekLabel : `${weekLabel}（暫停）`,
      missingNames: passportWeek > 0 ? english.missingNames : [],
      href: "/english",
      manualKey: null,
      manualCompleted: false,
    },
    {
      id: "makeup_homework",
      period: "day",
      label: "補交作業",
      status: homework.hasItems
        ? statusFromRatio(hwCompleted, hwTotal)
        : "done",
      completed: homework.hasItems ? hwCompleted : null,
      total: homework.hasItems ? hwTotal : null,
      detail: homework.hasItems
        ? hwMissing.length === 0
          ? "無缺交"
          : `缺交 ${hwMissing.length} 人`
        : "無需補交",
      missingNames: hwMissing,
      href: `/homework?date=${date}`,
      manualKey: null,
      manualCompleted: false,
    },
    {
      id: "lunch_brushing",
      period: "noon",
      label: "午餐刷牙",
      status: statusFromRatio(brushing.completed, brushing.total),
      completed: brushing.completed,
      total: brushing.total,
      detail: `已完成 ${brushing.completed}/${brushing.total}`,
      missingNames: brushing.missingNames,
      href: "/routines",
      manualKey: null,
      manualCompleted: false,
    },
    {
      id: "noon_cleaning",
      period: "noon",
      label: "中午打掃",
      status: statusFromRatio(noon.completed, noon.total),
      completed: noon.completed,
      total: noon.total,
      detail: `已完成 ${noon.completed}/${noon.total}`,
      missingNames: noon.missingNames,
      href: "/routines",
      manualKey: null,
      manualCompleted: false,
    },
    {
      id: "edit_contact_book",
      period: "dismissal",
      label: "編輯聯絡簿",
      status: editContactDone ? "done" : "pending",
      completed: null,
      total: null,
      detail: editContactDone
        ? `已存（繳交 ${contactBook.dueDate}）`
        : "尚未儲存今日聯絡簿",
      missingNames: [],
      href: "/contact-book",
      manualKey: null,
      manualCompleted: false,
    },
    {
      id: "reward_requests",
      period: "dismissal",
      label: "待處理獎品",
      status: pendingRewardRequests.length ? "attention" : "done",
      completed: null,
      total: null,
      detail: pendingRewardRequests.length ? `${pendingRewardRequests.length} 件等待核銷` : "目前沒有待處理申請",
      missingNames: pendingRewardRequests.map((item) => item.name),
      href: "/shop",
      manualKey: null,
      manualCompleted: false,
    },
  ];

  const periodMeta: { period: TodayItem["period"]; label: string }[] = [
    { period: "arrival", label: "到校" },
    { period: "day", label: "白天" },
    { period: "noon", label: "中午" },
    { period: "dismissal", label: "放學" },
  ];

  return {
    date,
    className: settings.className,
    weekProgressLabel: settings.weekProgressLabel,
    vacationCountdownLabel,
    periods: periodMeta.map((meta) => ({
      ...meta,
      items: items.filter((item) => item.period === meta.period),
    })),
  };
}

export async function setTodayManualCompletion(input: {
  taskKey: TodayManualKey;
  completed: boolean;
  taskDate?: string;
}) {
  return upsertTodayManual(input);
}
